import "server-only";
import { createHmac } from "node:crypto";
import { sendBatch } from "@/lib/email/send";
import { appUrl, serverEnv } from "@/lib/env";
import { formatLongDate } from "@/lib/format";
import { pushToUsers } from "@/lib/push/devices";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotifyKind = "notify_new_album" | "notify_access_ending";

export function unsubscribeToken(userId: string, kind: NotifyKind): string {
  return createHmac("sha256", serverEnv().SIGNED_URL_SECRET).update(`unsub:${userId}:${kind}`).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(userId: string, kind: NotifyKind): string {
  const params = new URLSearchParams({ u: userId, k: kind, t: unsubscribeToken(userId, kind) });
  return `${appUrl()}/unsubscribe?${params.toString()}`;
}

type Recipient = { userId: string; email: string; name: string; isOrganiser: boolean };

/** Everyone in the event who still wants this kind of email, minus the actor. */
async function recipients(eventId: string, kind: NotifyKind, exceptUserId?: string | null): Promise<Recipient[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("user_id, role, roster_name, claimed_name, accepted_at, status, users!inner(id, email, display_name, notify_new_album, notify_access_ending)")
    .eq("event_id", eventId)
    .eq("status", "active")
    .not("user_id", "is", null)
    .not("accepted_at", "is", null);
  if (error) throw error;

  return (data ?? [])
    .filter((m) => m.users[kind] && m.user_id !== exceptUserId)
    .map((m) => ({
      userId: m.users.id,
      email: m.users.email,
      name: m.claimed_name ?? m.users.display_name ?? m.roster_name,
      isOrganiser: m.role === "event_admin",
    }));
}

export async function notifyNewAlbum(eventId: string, albumId: string, actorUserId?: string | null): Promise<number> {
  const admin = createAdminClient();
  const [{ data: album }, { data: event }, { data: counts }] = await Promise.all([
    admin.from("albums").select("id, title, description, album_date").eq("id", albumId).is("deleted_at", null).maybeSingle(),
    admin.from("events").select("name, handle").eq("id", eventId).is("deleted_at", null).maybeSingle(),
    admin.from("album_media_counts").select("photo_count, video_count").eq("album_id", albumId).maybeSingle(),
  ]);
  if (!album || !event) return 0;

  const people = await recipients(eventId, "notify_new_album", actorUserId);
  if (people.length === 0) return 0;

  const albumUrl = `${appUrl()}/e/${event.handle}/a/${album.id}`;
  const albumMeta = [
    counts?.photo_count ? `${counts.photo_count} photos` : null,
    counts?.video_count ? `${counts.video_count} videos` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The same people get an iPhone notification if they use the app. The
  // email preference covers both, so one switch stops both.
  const push = pushToUsers(
    people.map((person) => person.userId),
    { title: event.name, body: albumMeta ? `${album.title} is up: ${albumMeta}` : `${album.title} is up`, url: albumUrl, threadId: `event-${eventId}` },
  );

  await sendBatch(
    people.map((person) => ({
      to: person.email,
      subject: `${event.name}: ${album.title} is up`,
      template: {
        kind: "album" as const,
        props: {
          name: person.name,
          eventName: event.name,
          albumTitle: album.title,
          albumMeta,
          albumUrl,
          unsubscribeUrl: unsubscribeUrl(person.userId, "notify_new_album"),
        },
      },
    })),
  );
  await push;
  return people.length;
}

/**
 * A week before an event's gallery closes, attendees who still want reminders
 * get one email saying so. Organisers aren't told: they never lose access.
 * Stamped per event, so an hourly cron sends it once, and cleared whenever the
 * closing date moves.
 */
export async function runAccessEndingJob(now = new Date()): Promise<{ events: number; emails: number }> {
  const admin = createAdminClient();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, handle, access_ends_at")
    .is("access_notice_sent_at", null)
    .gt("access_ends_at", now.toISOString())
    .lte("access_ends_at", inAWeek)
    .eq("status", "active")
    .is("deleted_at", null);
  if (error) throw error;

  let emails = 0;
  for (const event of events ?? []) {
    // Stamp first: a failed send is better than a second copy next hour.
    await admin.from("events").update({ access_notice_sent_at: now.toISOString() }).eq("id", event.id);
    const people = (await recipients(event.id, "notify_access_ending")).filter((p) => !p.isOrganiser);
    if (people.length === 0 || !event.access_ends_at) continue;
    const endsOn = formatLongDate(event.access_ends_at);
    await sendBatch(
      people.map((person) => ({
        to: person.email,
        subject: `The ${event.name} gallery closes on ${endsOn}`,
        template: {
          kind: "access_ending" as const,
          props: {
            name: person.name,
            eventName: event.name,
            endsOn,
            eventUrl: `${appUrl()}/e/${event.handle}`,
            unsubscribeUrl: unsubscribeUrl(person.userId, "notify_access_ending"),
          },
        },
      })),
    );
    emails += people.length;
  }
  return { events: events?.length ?? 0, emails };
}

/** Sign-in attempts older than a day are dead weight. */
export async function prunePendingSignIns(now = new Date()): Promise<void> {
  await createAdminClient()
    .from("pending_sign_ins")
    .delete()
    .lt("expires_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString());
}

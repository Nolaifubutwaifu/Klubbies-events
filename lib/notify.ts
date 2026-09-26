import "server-only";
import { createHmac } from "node:crypto";
import { sendBatch } from "@/lib/email/send";
import { appUrl, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotifyKind = "notify_new_album" | "notify_feed_post" | "notify_access_ending";

export function unsubscribeToken(userId: string, kind: NotifyKind): string {
  return createHmac("sha256", serverEnv().SIGNED_URL_SECRET).update(`unsub:${userId}:${kind}`).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(userId: string, kind: NotifyKind): string {
  const params = new URLSearchParams({ u: userId, k: kind, t: unsubscribeToken(userId, kind) });
  return `${appUrl()}/unsubscribe?${params.toString()}`;
}

type Recipient = { userId: string; email: string; name: string };

/** Everyone in the club who still wants this kind of email, minus the actor. */
async function recipients(clubId: string, kind: NotifyKind, exceptUserId?: string | null): Promise<Recipient[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("user_id, roster_name, claimed_name, accepted_at, status, users!inner(id, email, display_name, notify_new_album, notify_feed_post, notify_access_ending)")
    .eq("club_id", clubId)
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
    }));
}

export async function notifyNewAlbum(clubId: string, albumId: string, actorUserId?: string | null): Promise<number> {
  const admin = createAdminClient();
  const [{ data: album }, { data: club }, { data: counts }] = await Promise.all([
    admin.from("albums").select("id, title, description, event_date").eq("id", albumId).maybeSingle(),
    admin.from("clubs").select("name, handle").eq("id", clubId).maybeSingle(),
    admin.from("album_media_counts").select("photo_count, video_count").eq("album_id", albumId).maybeSingle(),
  ]);
  if (!album || !club) return 0;

  const people = await recipients(clubId, "notify_new_album", actorUserId);
  if (people.length === 0) return 0;

  await sendBatch(
    people.map((person) => ({
      to: person.email,
      subject: `${club.name}: ${album.title} is up`,
      template: {
        kind: "album" as const,
        props: {
          name: person.name,
          clubName: club.name,
          albumTitle: album.title,
          albumMeta: [
            counts?.photo_count ? `${counts.photo_count} photos` : null,
            counts?.video_count ? `${counts.video_count} videos` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          albumUrl: `${appUrl()}/c/${club.handle}/a/${album.id}`,
          unsubscribeUrl: unsubscribeUrl(person.userId, "notify_new_album"),
        },
      },
    })),
  );
  return people.length;
}

export async function notifyFeedPost(clubId: string, postId: string, actorUserId?: string | null): Promise<number> {
  const admin = createAdminClient();
  const [{ data: post }, { data: club }] = await Promise.all([
    // Named for the same reason as lib/feed/queries.ts: post_reactions gives
    // posts a second route to memberships.
    admin
      .from("posts")
      .select("id, body, author_membership_id, memberships!posts_author_membership_id_fkey(roster_name, claimed_name)")
      .eq("id", postId)
      .maybeSingle(),
    admin.from("clubs").select("name, handle").eq("id", clubId).maybeSingle(),
  ]);
  if (!post || !club) return 0;

  const people = await recipients(clubId, "notify_feed_post", actorUserId);
  if (people.length === 0) return 0;

  const author = post.memberships?.claimed_name ?? post.memberships?.roster_name ?? "The committee";

  await sendBatch(
    people.map((person) => ({
      to: person.email,
      subject: `${club.name}: ${author} posted an update`,
      template: {
        kind: "post" as const,
        props: {
          name: person.name,
          clubName: club.name,
          author,
          body: post.body.slice(0, 600),
          feedUrl: `${appUrl()}/c/${club.handle}/feed`,
          unsubscribeUrl: unsubscribeUrl(person.userId, "notify_feed_post"),
        },
      },
    })),
  );
  return people.length;
}

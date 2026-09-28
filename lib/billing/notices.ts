import "server-only";
import { after } from "next/server";
import { sendLetIn, sendPlanNotice } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { includedGuests, overflowWindow, TIERS, tierOffers, windowCeiling } from "./plans";
import { getPlanUsage } from "./usage";

/**
 * The limit emails (pricing handoff §5.5), each sent once per event per plan.
 * A notice is claimed by stamping its column only while it is still empty, so
 * two runs at once can't both send it; a plan change clears the stamps.
 *
 * Called straight after anything that can cross a line (a guest joining, an
 * upload finishing, someone being let in) and by the hourly job for the ones
 * that only time crosses (12 hours left, the window closing).
 */

type NoticeColumn =
  | "guests_nearly_full_notified_at"
  | "overflow_open_notified_at"
  | "overflow_reminder_notified_at"
  | "overflow_closed_notified_at"
  | "photos_nearly_full_notified_at"
  | "photos_full_notified_at";

const NEARLY = 0.9;
const REMINDER_AFTER_HOURS = 36;

async function claim(eventId: string, column: NoticeColumn): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("events")
    .update({ [column]: new Date().toISOString() } as Partial<Record<NoticeColumn, string>>)
    .eq("id", eventId)
    .is(column, null)
    .select("id");
  return (data?.length ?? 0) > 0;
}

async function organisers(eventId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("memberships")
    .select("role, event_roles(manage_event), users!inner(email)")
    .eq("event_id", eventId)
    .eq("status", "active")
    .not("user_id", "is", null);
  return (data ?? []).filter((m) => m.role === "event_admin" || m.event_roles?.manage_event).map((m) => m.users.email);
}

export async function checkPlanNotices(eventId: string, now = new Date()): Promise<number> {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event || event.deleted_at) return 0;
  const usage = await getPlanUsage(eventId);
  if (!usage) return 0;

  const billing = `${appUrl()}/admin/${event.handle}/billing`;
  const offers = tierOffers(event).map((o) => `${TIERS[o.to].name} (up to ${TIERS[o.to].guests.toLocaleString("en-AU")} guests): A$${o.amount}`);
  const common = { eventName: event.name, offers, buttonLabel: "Choose a bigger size", buttonUrl: billing };
  const notices: { column: NoticeColumn; subject: string; heading: string; paragraphs: string[] }[] = [];

  const limit = usage.guestLimit;
  const { windowEnds, windowOpen } = overflowWindow(event, now);
  if (limit) {
    const included = includedGuests(limit);
    if (!event.overflow_started_at && usage.guestsJoined >= Math.ceil(limit * NEARLY)) {
      notices.push({
        column: "guests_nearly_full_notified_at",
        subject: `${event.name} is nearly full`,
        heading: "Your event is nearly full",
        paragraphs: [
          `${usage.guestsJoined} of ${limit} guests have joined ${event.name}. Up to ${included} can join before it runs out of room.`,
          "Upgrade now and you pay only the difference between the two sizes.",
        ],
      });
    }
    if (windowOpen && windowEnds) {
      const window = [
        `Guests can keep joining for 48 hours, until ${formatDateTime(windowEnds)}, up to ${windowCeiling(limit)}. Upgrade before then to keep them all.`,
        `If nobody upgrades, the guests who joined after the first ${included} are paused until you do. They keep their account and selfie.`,
        "Because the event has run out of room, upgrading now costs the difference plus 25%:",
      ];
      notices.push({
        column: "overflow_open_notified_at",
        subject: `${event.name} is over its guest limit`,
        heading: "Your event is over its guest limit",
        paragraphs: [`${usage.guestsJoined} guests have joined ${event.name}, past its ${limit} and the 10% included.`, ...window],
      });
      if (event.overflow_open_notified_at && event.overflow_started_at && now.getTime() - new Date(event.overflow_started_at).getTime() >= REMINDER_AFTER_HOURS * 3600 * 1000) {
        notices.push({
          column: "overflow_reminder_notified_at",
          subject: `12 hours left to upgrade ${event.name}`,
          heading: "12 hours left to upgrade",
          paragraphs: [`${usage.guestsJoined} guests have joined ${event.name}.`, ...window],
        });
      }
    }
    if (event.overflow_closed_at && usage.guestsPaused > 0) {
      notices.push({
        column: "overflow_closed_notified_at",
        subject: `${usage.guestsPaused} guests are paused at ${event.name}`,
        heading: `${usage.guestsPaused} ${usage.guestsPaused === 1 ? "guest is" : "guests are"} paused`,
        paragraphs: [
          `The 2 day window closed without an upgrade, so the ${usage.guestsPaused === 1 ? "guest" : "guests"} who joined last can't see photos yet.`,
          "Upgrade any time to let them all in at once. Or remove guests to make room: the earliest paused guest is let in automatically.",
        ],
      });
    }
  }

  const photoLimit = usage.photoLimit;
  if (photoLimit) {
    if (usage.unitsUsed >= photoLimit) {
      notices.push({
        column: "photos_full_notified_at",
        subject: `Uploads have stopped at ${event.name}`,
        heading: "Your event has used all its photos",
        paragraphs: [
          `${event.name} has used all ${photoLimit.toLocaleString("en-AU")} of its photos, so uploads have stopped. Photographers are told to ask you to make room.`,
          "Upgrade to keep uploading, or delete photos you don't need.",
        ],
      });
    } else if (usage.unitsUsed >= Math.ceil(photoLimit * NEARLY)) {
      notices.push({
        column: "photos_nearly_full_notified_at",
        subject: `${event.name} is nearly out of photos`,
        heading: "Your event is nearly out of photos",
        paragraphs: [
          `${event.name} has used ${usage.unitsUsed.toLocaleString("en-AU")} of its ${photoLimit.toLocaleString("en-AU")} photos. Each started minute of video counts as 10.`,
          "Upgrade now to keep uploading without a break.",
        ],
      });
    }
  }

  let sent = 0;
  const to = notices.length ? await organisers(eventId) : [];
  for (const notice of notices) {
    if (to.length === 0 || !(await claim(eventId, notice.column))) continue;
    for (const email of to) {
      await sendPlanNotice(email, notice.subject, { ...common, heading: notice.heading, paragraphs: notice.paragraphs }).catch((error) =>
        console.error("plan notice failed", eventId, notice.column, error),
      );
    }
    sent += 1;
  }

  // Guests let back in: one email each, claimed by clearing let_in_at.
  const { data: letIn } = await admin
    .from("memberships")
    .select("id, roster_name, claimed_name, users!inner(email, display_name)")
    .eq("event_id", eventId)
    .not("let_in_at", "is", null)
    .is("paused_at", null)
    .limit(500);
  for (const m of letIn ?? []) {
    const { data: claimed } = await admin.from("memberships").update({ let_in_at: null }).eq("id", m.id).not("let_in_at", "is", null).select("id");
    if (!claimed?.length) continue;
    await sendLetIn(m.users.email, {
      name: m.claimed_name ?? m.users.display_name ?? m.roster_name,
      eventName: event.name,
      eventUrl: `${appUrl()}/e/${event.handle}`,
    }).catch((error) => console.error("let-in email failed", m.id, error));
  }
  return sent;
}

/** After a join, an upload or someone being let in. Never throws, never delays the response. */
export function kickPlanNotices(eventId: string): void {
  const run = () => checkPlanNotices(eventId).catch((error) => console.error("plan notices failed", eventId, error));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** The hourly pass, for the notices only time crosses: 12 hours left, the window closed, let-in emails. */
export async function runPlanNotices(now = new Date()): Promise<number> {
  const admin = createAdminClient();
  const [{ data: windows }, { data: letIn }] = await Promise.all([
    admin
      .from("events")
      .select("id")
      .not("overflow_started_at", "is", null)
      .or("overflow_reminder_notified_at.is.null,overflow_closed_notified_at.is.null")
      .limit(200),
    admin.from("memberships").select("event_id").not("let_in_at", "is", null).limit(500),
  ]);
  const ids = new Set([...(windows ?? []).map((e) => e.id), ...(letIn ?? []).map((m) => m.event_id)]);
  let sent = 0;
  for (const id of ids) sent += await checkPlanNotices(id, now).catch(() => 0);
  return sent;
}

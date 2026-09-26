import "server-only";
import { sendGraceNotice } from "@/lib/email/send";
import { serverEnv } from "@/lib/env";
import { formatLongDate } from "@/lib/format";
import { clubUrl } from "@/lib/roster/handle";
import { createAdminClient } from "@/lib/supabase/admin";

export const GRACE_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;

// Notices go out on day 1 (at removal), day 7 and day 29.
const NOTICE_SCHEDULE = [0, 6, 28];

export function graceWindow(from = new Date()) {
  return { startedAt: from.toISOString(), endsAt: new Date(from.getTime() + GRACE_DAYS * DAY_MS).toISOString() };
}

type GraceRow = {
  id: string;
  roster_email: string;
  roster_name: string;
  claimed_name: string | null;
  grace_started_at: string | null;
  grace_ends_at: string | null;
  grace_notices_sent: number;
  clubs: { name: string; handle: string };
};

export async function sendDueGraceNotice(row: GraceRow, now = new Date()): Promise<boolean> {
  if (!row.grace_started_at || !row.grace_ends_at) return false;
  const next = row.grace_notices_sent;
  if (next >= NOTICE_SCHEDULE.length) return false;
  const daysIn = (now.getTime() - new Date(row.grace_started_at).getTime()) / DAY_MS;
  if (daysIn < NOTICE_SCHEDULE[next]) return false;

  await sendGraceNotice(row.roster_email, {
    name: row.claimed_name ?? row.roster_name,
    clubName: row.clubs.name,
    endsOn: formatLongDate(row.grace_ends_at),
    clubUrl: clubUrl(serverEnv().APP_URL, row.clubs.handle),
    finalNotice: next === NOTICE_SCHEDULE.length - 1,
  });
  // Skip notices that are already overdue so a late cron never sends two at once.
  let sent = next + 1;
  while (sent < NOTICE_SCHEDULE.length && daysIn >= NOTICE_SCHEDULE[sent]) sent++;
  await createAdminClient().from("memberships").update({ grace_notices_sent: sent }).eq("id", row.id);
  return true;
}

export async function runGraceJob(now = new Date()) {
  const admin = createAdminClient();
  const nowIso = now.toISOString();

  const { data: revoked, error: revokeError } = await admin
    .from("memberships")
    .update({ status: "revoked" })
    .eq("status", "grace")
    .lte("grace_ends_at", nowIso)
    .select("id");
  if (revokeError) throw revokeError;

  let notices = 0;
  for (let from = 0; ; from += 500) {
    const { data, error } = await admin
      .from("memberships")
      .select("id, roster_email, roster_name, claimed_name, grace_started_at, grace_ends_at, grace_notices_sent, clubs!inner(name, handle)")
      .eq("status", "grace")
      .gt("grace_ends_at", nowIso)
      .lt("grace_notices_sent", NOTICE_SCHEDULE.length)
      .order("id")
      .range(from, from + 499);
    if (error) throw error;
    for (const row of data ?? []) {
      try {
        if (await sendDueGraceNotice(row, now)) notices++;
      } catch (err) {
        console.error("grace notice failed", row.id, err);
      }
    }
    if (!data || data.length < 500) break;
  }

  await admin.from("pending_sign_ins").delete().lt("expires_at", new Date(now.getTime() - DAY_MS).toISOString());

  return { revoked: revoked?.length ?? 0, notices };
}

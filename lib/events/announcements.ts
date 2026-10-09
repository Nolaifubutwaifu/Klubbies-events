import "server-only";
import { createHmac } from "node:crypto";
import { canWrite } from "@/lib/billing/status";
import { appUrl, serverEnv } from "@/lib/env";
import { normaliseEmail } from "@/lib/roster/email";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sends per event: enough for "photos are up" and a reminder or two. */
export const ANNOUNCEMENT_LIMIT = 3;
/** Between two sends, so a double tap or a typo fix can't email everyone twice in a row. */
export const ANNOUNCEMENT_GAP_MS = 60 * 60 * 1000;

/** Sending it for the organiser is part of the paid sizes; copying it is free. */
export function canSendAnnouncements(event: { plan: string; billing_status: string; photos_deleted_at?: string | null }): boolean {
  return event.plan !== "free" && canWrite(event);
}

export function announcementOptOutToken(eventId: string, email: string): string {
  return createHmac("sha256", serverEnv().SIGNED_URL_SECRET).update(`announce:${eventId}:${email}`).digest("hex").slice(0, 32);
}

export function announcementOptOutUrl(eventId: string, email: string): string {
  const params = new URLSearchParams({ a: eventId, e: email, t: announcementOptOutToken(eventId, email) });
  return `${appUrl()}/unsubscribe?${params.toString()}`;
}

/**
 * Everyone the announcement goes to: the event's guests (on the list or
 * joined), not its organisers, minus anyone who opted out. One per address.
 */
export async function announcementRecipients(eventId: string): Promise<{ email: string; name: string | null }[]> {
  const admin = createAdminClient();
  const [{ data: members }, { data: optouts }] = await Promise.all([
    admin
      .from("memberships")
      .select("roster_email, roster_name, claimed_name, role, event_roles(manage_event)")
      .eq("event_id", eventId)
      .in("status", ["pending", "active", "grace"])
      .limit(20000),
    admin.from("announcement_optouts").select("email").eq("event_id", eventId),
  ]);
  const out = new Set((optouts ?? []).map((o) => o.email));
  const seen = new Set<string>();
  const recipients: { email: string; name: string | null }[] = [];
  for (const m of members ?? []) {
    if (m.role === "event_admin" || m.event_roles?.manage_event) continue;
    const email = m.roster_email ? normaliseEmail(m.roster_email) : "";
    if (!email || out.has(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email, name: m.claimed_name ?? m.roster_name ?? null });
  }
  return recipients;
}

/** What the share page shows: how many it would reach, and what's been sent. */
export async function announcementStatus(eventId: string) {
  const admin = createAdminClient();
  const [recipients, { data: sent }] = await Promise.all([
    announcementRecipients(eventId),
    admin.from("event_announcements").select("subject, recipient_count, sent_at").eq("event_id", eventId).order("sent_at", { ascending: false }),
  ]);
  return { recipientCount: recipients.length, sent: sent ?? [] };
}

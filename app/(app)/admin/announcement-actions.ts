"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getEventContextById, getProfile } from "@/lib/auth/session";
import { sendAnnouncements } from "@/lib/email/send";
import {
  ANNOUNCEMENT_GAP_MS,
  ANNOUNCEMENT_LIMIT,
  announcementOptOutUrl,
  announcementRecipients,
  canSendAnnouncements,
} from "@/lib/events/announcements";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { eventLink } from "@/lib/share";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import type { ActionState } from "./actions";

const schema = z.object({
  subject: z.string().trim().min(3, "Add a subject").max(150, "Keep the subject under 150 characters"),
  body: z.string().trim().min(10, "Write a short message").max(4000, "Keep the message under 4,000 characters"),
});

/**
 * Sends the organiser's announcement to every guest, from us with their name
 * on it (paid sizes). Checked: permission, size, the per event limit and the
 * gap between sends. The emails go out after the answer.
 */
export async function sendAnnouncementAction(eventId: string, subject: string, body: string): Promise<ActionState> {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.perms.manage_event) return { error: "Only organisers can send this" };
  if (!canSendAnnouncements(ctx.event)) {
    const inApp = isNativeAppUserAgent((await headers()).get("user-agent"));
    return { error: inApp ? "Sending it for you isn't included in this event's size." : "Sending it for you is part of the paid sizes. Copy it instead, or choose a size on the Plan page." };
  }
  const parsed = schema.safeParse({ subject, body });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const admin = createAdminClient();
  const { data: sent } = await admin.from("event_announcements").select("sent_at").eq("event_id", eventId).order("sent_at", { ascending: false });
  if ((sent?.length ?? 0) >= ANNOUNCEMENT_LIMIT) return { error: `This event has sent its ${ANNOUNCEMENT_LIMIT} announcements.` };
  if (sent?.[0] && Date.now() - new Date(sent[0].sent_at).getTime() < ANNOUNCEMENT_GAP_MS) {
    return { error: "The last one went out less than an hour ago. Try again later." };
  }

  const recipients = await announcementRecipients(eventId);
  if (recipients.length === 0) return { error: "There's nobody to send it to yet. Add a guest list, or share the link first." };

  const profile = await getProfile();
  const { error } = await admin.from("event_announcements").insert({
    event_id: eventId,
    sent_by: ctx.userId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipient_count: recipients.length,
  });
  if (error) return { error: "Couldn't send it. Try again." };

  const organiser = ctx.event.organisation || profile?.display_name || ctx.event.name;
  const eventUrl = eventLink(ctx.event.handle);
  after(async () => {
    try {
      await sendAnnouncements(
        recipients.map((r) => ({
          to: r.email,
          subject: parsed.data.subject,
          props: { eventName: ctx.event.name, organiser, body: parsed.data.body, eventUrl, unsubscribeUrl: announcementOptOutUrl(eventId, r.email) },
        })),
        profile?.email ?? null,
      );
    } catch (sendError) {
      console.error("announcement send failed", eventId, sendError);
    }
  });

  revalidatePath(`/admin/${ctx.event.handle}/share`);
  return { ok: true, message: `Sending to ${recipients.length.toLocaleString("en-AU")} ${recipients.length === 1 ? "person" : "people"}.` };
}

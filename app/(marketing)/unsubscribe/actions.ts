"use server";

import { redirect } from "next/navigation";
import { unsubscribeToken, type NotifyKind } from "@/lib/notify";
import { announcementOptOutToken } from "@/lib/events/announcements";
import { createAdminClient } from "@/lib/supabase/admin";

const KINDS: NotifyKind[] = ["notify_new_album", "notify_access_ending"];

/** Signed one-click unsubscribe; no session needed, since it comes from an email. */
export async function unsubscribeAction(userId: string, kind: NotifyKind, token: string): Promise<void> {
  if (!KINDS.includes(kind) || token !== unsubscribeToken(userId, kind)) {
    redirect("/unsubscribe");
  }
  const off = kind === "notify_new_album" ? { notify_new_album: false } : { notify_access_ending: false };
  await createAdminClient().from("users").update(off).eq("id", userId);
  redirect("/unsubscribe?done=1");
}

/** Stops an event's announcement emails to one address; works without an account. */
export async function optOutOfAnnouncementsAction(eventId: string, email: string, token: string): Promise<void> {
  if (token !== announcementOptOutToken(eventId, email)) redirect("/unsubscribe");
  await createAdminClient().from("announcement_optouts").upsert({ event_id: eventId, email }, { onConflict: "event_id,email", ignoreDuplicates: true });
  redirect("/unsubscribe?done=1");
}

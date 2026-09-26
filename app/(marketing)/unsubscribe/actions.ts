"use server";

import { redirect } from "next/navigation";
import { unsubscribeToken, type NotifyKind } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const KINDS: NotifyKind[] = ["notify_new_album", "notify_feed_post", "notify_access_ending"];

/** Signed one-click unsubscribe; no session needed, since it comes from an email. */
export async function unsubscribeAction(userId: string, kind: NotifyKind, token: string): Promise<void> {
  if (!KINDS.includes(kind) || token !== unsubscribeToken(userId, kind)) {
    redirect("/unsubscribe");
  }
  const off =
    kind === "notify_new_album"
      ? { notify_new_album: false }
      : kind === "notify_feed_post"
        ? { notify_feed_post: false }
        : { notify_access_ending: false };
  await createAdminClient().from("users").update(off).eq("id", userId);
  redirect("/unsubscribe?done=1");
}

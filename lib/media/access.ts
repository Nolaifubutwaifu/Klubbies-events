import "server-only";
import type { EventContext } from "@/lib/auth/session";
import { clientFingerprint } from "@/lib/auth/request";
import { createAdminClient } from "@/lib/supabase/admin";

/** Appends to the access log. Callers must already have authorised the read. */
export async function logAccess(ctx: EventContext, mediaId: string | null, action: "view" | "download" | "zip") {
  try {
    const { ipHash, userAgent } = await clientFingerprint();
    await createAdminClient().from("access_events").insert({
      event_id: ctx.event.id,
      membership_id: ctx.membership?.id ?? null,
      media_id: mediaId,
      action,
      ip_hash: ipHash,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error("access log failed", error);
  }
}

/** One "download" row per file, in one insert: a Save to Photos batch. Callers must already have authorised the read. */
export async function logDownloads(ctx: EventContext, mediaIds: readonly string[]) {
  if (mediaIds.length === 0) return;
  try {
    const { ipHash, userAgent } = await clientFingerprint();
    await createAdminClient()
      .from("access_events")
      .insert(
        mediaIds.map((mediaId) => ({
          event_id: ctx.event.id,
          membership_id: ctx.membership?.id ?? null,
          media_id: mediaId,
          action: "download" as const,
          ip_hash: ipHash,
          user_agent: userAgent,
        })),
      );
  } catch (error) {
    console.error("access log failed", error);
  }
}

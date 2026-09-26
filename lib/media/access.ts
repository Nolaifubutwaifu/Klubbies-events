import "server-only";
import type { ClubContext } from "@/lib/auth/session";
import { clientFingerprint } from "@/lib/auth/request";
import { createAdminClient } from "@/lib/supabase/admin";

/** Appends to the access log. Callers must already have authorised the read. */
export async function logAccess(ctx: ClubContext, mediaId: string | null, action: "view" | "download" | "zip") {
  try {
    const { ipHash, userAgent } = await clientFingerprint();
    await createAdminClient().from("access_events").insert({
      club_id: ctx.club.id,
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

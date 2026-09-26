"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./admin/actions";

// Asking is instant and needs no reason; the photo hides the moment a member
// asks. Confirming — the part that deletes an original — is the committee's,
// and doing nothing for seven days counts as confirming.

export async function requestRemovalAction(mediaId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(mediaId).success) return { error: "Not found" };

  const supabase = await createClient();
  const { data: media } = await supabase.from("media").select("id, club_id, album_id").eq("id", mediaId).maybeSingle();
  if (!media) return { error: "Not found" };

  const ctx = await getClubContextById(media.club_id);
  if (!ctx?.membership) return { error: "Not authorised" };
  if (!ctx.club.allow_removal_requests) {
    return { error: "This club asks you to contact the committee directly." };
  }

  const { error } = await supabase.from("media_removal_requests").insert({
    club_id: media.club_id,
    media_id: media.id,
    requested_by: ctx.userId,
  });
  // A duplicate means someone already asked, which is the same outcome.
  if (error && error.code !== "23505") return { error: "Could not send the request" };

  // Hiding edits a media row the member may not own, so it runs with the
  // service role — after the checks above, never before them.
  await createAdminClient().from("media").update({ hidden_at: new Date().toISOString() }).eq("id", media.id);

  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true, message: "Hidden. Your media officer confirms it from here." };
}

async function loadRequest(requestId: string) {
  if (!z.uuid().safeParse(requestId).success) return null;
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("media_removal_requests")
    .select("id, club_id, media_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;
  const ctx = await getClubContextById(request.club_id);
  if (!ctx?.perms.manage_albums) return null;
  return { request, ctx, supabase };
}

/** Puts the photo back and tells the member who asked. */
export async function restorePhotoAction(requestId: string): Promise<ActionState> {
  const loaded = await loadRequest(requestId);
  if (!loaded) return { error: "Not authorised" };
  const { request, ctx, supabase } = loaded;
  if (request.status !== "open") return { error: "That request is already settled" };

  await supabase
    .from("media_removal_requests")
    .update({ status: "restored", resolved_at: new Date().toISOString(), resolved_by: ctx.userId })
    .eq("id", request.id);
  await supabase.from("media").update({ hidden_at: null }).eq("id", request.media_id);

  revalidatePath(`/admin/${ctx.club.handle}`, "layout");
  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true, message: "Back in the album. We've let them know." };
}

/** Deletes the original for good. There is no undo, and the copy says so. */
export async function confirmRemovalAction(requestId: string): Promise<ActionState> {
  const loaded = await loadRequest(requestId);
  if (!loaded) return { error: "Not authorised" };
  const { request, ctx, supabase } = loaded;
  if (request.status !== "open") return { error: "That request is already settled" };

  const { data: media } = await supabase
    .from("media")
    .select("id, storage_path, thumb_path, display_path, poster_path")
    .eq("id", request.media_id)
    .maybeSingle();

  await supabase
    .from("media_removal_requests")
    .update({ status: "confirmed", resolved_at: new Date().toISOString(), resolved_by: ctx.userId })
    .eq("id", request.id);

  if (media) {
    // The row goes first: a stray object is tidier than a row pointing at a
    // file that isn't there.
    await supabase.from("media").delete().eq("id", media.id);
    await removeObjects(
      [media.storage_path, media.thumb_path, media.display_path, media.poster_path].filter(
        (p): p is string => Boolean(p),
      ),
    ).catch(() => undefined);
    // The media_faces rows cascaded away and their trigger queued the
    // faceprints. Draining here rather than waiting for the hourly cron means
    // "the faceprint goes when the photo goes" is true in the same request.
    await drainFacePurgeQueue().catch((purgeError) => console.error("face purge after removal", purgeError));
  }

  revalidatePath(`/admin/${ctx.club.handle}`, "layout");
  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true, message: "Deleted. The original is gone." };
}

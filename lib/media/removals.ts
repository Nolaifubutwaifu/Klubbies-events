import "server-only";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export type RemovalSweepResult = { due: number; deleted: number };

/**
 * A removal request the committee never answered deletes the photo after seven
 * days. Silence is treated as agreement, because the member asked and nobody
 * disagreed — the alternative is a photo that stays hidden forever and an
 * inbox item nobody clears.
 */
export async function runRemovalSweep(now = new Date()): Promise<RemovalSweepResult> {
  const admin = createAdminClient();

  const { data: due } = await admin
    .from("media_removal_requests")
    .select("id, media_id")
    .eq("status", "open")
    .lte("auto_delete_at", now.toISOString())
    .limit(200);

  const rows = due ?? [];
  let deleted = 0;

  for (const request of rows) {
    const { data: media } = await admin
      .from("media")
      .select("id, storage_path, thumb_path, display_path, poster_path")
      .eq("id", request.media_id)
      .maybeSingle();

    const { error } = await admin
      .from("media_removal_requests")
      .update({ status: "confirmed", resolved_at: now.toISOString(), resolved_by: null })
      .eq("id", request.id)
      .eq("status", "open"); // lost the race with a committee decision
    if (error) continue;

    if (media) {
      await admin.from("media").delete().eq("id", media.id);
      await removeObjects(
        [media.storage_path, media.thumb_path, media.display_path, media.poster_path].filter(
          (path): path is string => Boolean(path),
        ),
      ).catch((sweepError) => console.error("removal sweep could not delete objects", media.id, sweepError));
    }
    deleted += 1;
  }

  // Each deleted photo cascaded its media_faces rows, whose trigger queued
  // the faceprints for removal from AWS.
  if (deleted > 0) {
    await drainFacePurgeQueue().catch((error) => console.error("face purge after removal sweep", error));
  }

  return { due: rows.length, deleted };
}

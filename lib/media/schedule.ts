import "server-only";
import { notifyNewAlbum } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export type ScheduleResult = { due: number; published: number; skipped: number };

/**
 * Publishes drafts whose scheduled time has passed.
 *
 * Runs with the service role, so it has to re-apply the rules the interactive
 * path enforces: an album with nothing ready in it is left alone rather than
 * published empty, and members are notified exactly once — on the album's
 * first publish, matching setAlbumPublishedAction.
 */
export async function runScheduledPublishJob(now = new Date()): Promise<ScheduleResult> {
  const admin = createAdminClient();

  const { data: due } = await admin
    .from("albums")
    .select("id, club_id, published_at")
    .eq("status", "draft")
    .not("publish_at", "is", null)
    .lte("publish_at", now.toISOString())
    .limit(200);

  const rows = due ?? [];
  let published = 0;
  let skipped = 0;

  for (const album of rows) {
    const { count } = await admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("album_id", album.id)
      .eq("status", "ready");

    // An empty album stays a draft and keeps its schedule, so the committee
    // can still upload and have it go live on the next pass.
    if (!count) {
      skipped += 1;
      continue;
    }

    const firstPublish = album.published_at === null;
    const { error } = await admin
      .from("albums")
      .update({
        status: "published",
        published_at: album.published_at ?? now.toISOString(),
        publish_at: null,
      })
      .eq("id", album.id)
      .eq("status", "draft"); // lost race with a manual publish: leave it be
    if (error) {
      skipped += 1;
      continue;
    }

    published += 1;
    if (firstPublish) {
      try {
        await notifyNewAlbum(album.club_id, album.id, null);
      } catch (notifyError) {
        console.error("scheduled album notification failed", album.id, notifyError);
      }
    }
  }

  return { due: rows.length, published, skipped };
}

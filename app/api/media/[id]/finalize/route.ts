import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { eventFacesEnabled } from "@/lib/faces/collections";
import { kickPlanNotices } from "@/lib/billing/notices";
import { mediaUnits } from "@/lib/billing/plans";
import { PHOTOS_FULL } from "@/lib/billing/usage";
import { formatDuration } from "@/lib/format";
import { enqueueMediaJob, kickFaceJobs } from "@/lib/faces/jobs";
import { maxBytesForKind, oversizeMessage } from "@/lib/media/constants";
import { kickVideoPreviews } from "@/lib/media/video-previews";
import { derivativePaths, folderObjects, ownedMediaObjectPath, removeObjects } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  width: z.number().int().positive().max(100000).nullable(),
  height: z.number().int().positive().max(100000).nullable(),
  durationSeconds: z.number().nonnegative().max(86400).nullable(),
  capturedAt: z.iso.datetime({ offset: true }).nullable(),
  failed: z.boolean().default(false),
});

export async function POST(request: Request, ctx: RouteContext<"/api/media/[id]/finalize">) {
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: media } = await supabase.from("media").select("*").eq("id", id).maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The uploader finishes their own file; organisers can finish anyone's.
  const event = await getEventContextById(media.event_id);
  if (!event || (!event.perms.manage_albums && media.uploaded_by !== event.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.failed) {
    // A lost response can make the browser report failure after this file
    // already landed. Don't take a finished photo back out of the album.
    await supabase.from("media").update({ status: "failed" }).eq("id", id).neq("status", "ready");
    return NextResponse.json({ ok: true });
  }

  // Already finished (the response was lost, so the browser tried again).
  // Face enqueue is idempotent; the other side effects already ran.
  if (media.status === "ready") {
    if (media.kind === "video" && (!media.poster_path || media.duration_seconds == null)) kickVideoPreviews();
    await indexFaces(media.event_id, id);
    return NextResponse.json({ ok: true });
  }

  if (!media.album_id || !ownedMediaObjectPath(media.event_id, media.album_id, media.id, media.storage_path)) {
    console.error("refusing to finish an upload whose path is outside its row", id);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const folder = media.storage_path.slice(0, media.storage_path.lastIndexOf("/"));
  const originalName = media.storage_path.slice(folder.length + 1);
  const objects = await folderObjects(
    { eventId: media.event_id, albumId: media.album_id, mediaId: media.id },
    [originalName, "thumb.webp", "display.webp", "poster.jpg"],
  );
  if (!objects.has(originalName)) {
    return NextResponse.json({ error: "The original file has not finished uploading" }, { status: 409 });
  }

  const paths = derivativePaths(folder);
  const byteSize = objects.get(originalName) || media.byte_size || 0;
  const kind = media.kind === "video" ? "video" : "photo";
  if (byteSize > maxBytesForKind(kind)) {
    await supabase.from("media").update({ status: "failed" }).eq("id", id).neq("status", "ready");
    await removeObjects([
      media.storage_path,
      ...(objects.has("thumb.webp") ? [paths.thumb] : []),
      ...(objects.has("display.webp") ? [paths.display] : []),
      ...(objects.has("poster.jpg") ? [paths.poster] : []),
    ]);
    return NextResponse.json({ error: oversizeMessage(media.original_filename || "This file", kind) }, { status: 413 });
  }
  const { width, height, durationSeconds, capturedAt } = parsed.data;
  const { data: updated, error } = await supabase
    .from("media")
    .update({
      status: "ready",
      width,
      height,
      duration_seconds: durationSeconds,
      captured_at: capturedAt,
      byte_size: byteSize,
      thumb_path: objects.has("thumb.webp") ? paths.thumb : null,
      display_path: objects.has("display.webp") ? paths.display : null,
      poster_path: objects.has("poster.jpg") ? paths.poster : null,
    })
    .eq("id", id)
    .neq("status", "ready")
    .select("id");
  if (error?.code === PHOTOS_FULL) {
    // The real length came in over what's left of the allowance (migration 34).
    await supabase.from("media").update({ status: "failed" }).eq("id", id).neq("status", "ready");
    const length = durationSeconds ? formatDuration(durationSeconds) : "this video";
    return NextResponse.json(
      {
        error: `This video (${length}) counts as ${mediaUnits("video", durationSeconds)} photos, more than this event has left. Trim it, or remove other files first.`,
      },
      { status: 409 },
    );
  }
  if (error) return NextResponse.json({ error: "Could not finish the upload" }, { status: 500 });
  // A parallel retry already finished this row. Don't kick the side effects twice.
  if (!updated?.length) {
    await indexFaces(media.event_id, id);
    return NextResponse.json({ ok: true });
  }

  // The R2 copy waits for the hourly backup drain (a ready row with no
  // backed_up_at). Doing it here streamed the original inside this request.
  kickPlanNotices(media.event_id);
  if (media.kind === "video" && (!objects.has("poster.jpg") || durationSeconds == null)) kickVideoPreviews();
  await indexFaces(media.event_id, id);

  return NextResponse.json({ ok: true });
}

/**
 * Face recognition, when the event has turned it on. A missing face job is a
 * nuisance, a failed upload is not. The insert is unique per photo, so a
 * retry that lost the first response does not queue a second job. The drain
 * is kicked here rather than left to the hourly cron, or "Photos of you"
 * would lag by up to an hour and read as broken.
 */
async function indexFaces(eventId: string, mediaId: string): Promise<void> {
  try {
    if (await eventFacesEnabled(eventId)) {
      await enqueueMediaJob(eventId, mediaId);
      kickFaceJobs();
    }
  } catch (faceError) {
    console.error("could not queue face indexing", mediaId, faceError);
  }
}

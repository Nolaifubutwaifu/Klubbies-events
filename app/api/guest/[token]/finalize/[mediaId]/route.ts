import { NextResponse } from "next/server";
import { z } from "zod";
import { eventFacesEnabled } from "@/lib/faces/collections";
import { enqueueMediaJob, kickFaceJobs } from "@/lib/faces/jobs";
import { recordGuestUpload, resolveGuestLink } from "@/lib/guest/links";
import { maxBytesForKind, oversizeMessage } from "@/lib/media/constants";
import { kickVideoPreviews } from "@/lib/media/video-previews";
import { derivativePaths, folderObjects, ownedMediaObjectPath, removeObjects } from "@/lib/storage";
import { kickPlanNotices } from "@/lib/billing/notices";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  width: z.number().int().positive().max(100000).nullable(),
  height: z.number().int().positive().max(100000).nullable(),
  durationSeconds: z.number().nonnegative().max(86400).nullable(),
  capturedAt: z.iso.datetime({ offset: true }).nullable(),
  failed: z.boolean().default(false),
});

export async function POST(request: Request, ctx: RouteContext<"/api/guest/[token]/finalize/[mediaId]">) {
  const { token, mediaId } = await ctx.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(mediaId).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { session } = await resolveGuestLink(token);
  if (!session) return NextResponse.json({ error: "This link isn't valid any more." }, { status: 403 });

  const admin = createAdminClient();
  // The link may only finish files it started: the guest_link_id is the check.
  const { data: media } = await admin
    .from("media")
    .select("id, event_id, album_id, storage_path, byte_size, guest_link_id, status, kind, poster_path, duration_seconds, original_filename")
    .eq("id", mediaId)
    .eq("guest_link_id", session.linkId)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.failed) {
    // A lost response can report failure after the file already landed.
    await admin.from("media").update({ status: "failed" }).eq("id", mediaId).neq("status", "ready");
    return NextResponse.json({ ok: true });
  }

  if (media.status === "ready") {
    if (media.kind === "video" && (!media.poster_path || media.duration_seconds == null)) kickVideoPreviews();
    await indexFaces(media.event_id, mediaId);
    return NextResponse.json({ ok: true });
  }

  if (!media.album_id || !ownedMediaObjectPath(media.event_id, media.album_id, media.id, media.storage_path)) {
    console.error("refusing to finish a guest upload whose path is outside its row", mediaId);
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
  const byteSize = objects.get(originalName) ?? media.byte_size ?? 0;
  const kind = media.kind === "video" ? "video" : "photo";
  if (byteSize > maxBytesForKind(kind)) {
    await admin.from("media").update({ status: "failed" }).eq("id", mediaId).neq("status", "ready");
    await removeObjects([
      media.storage_path,
      ...(objects.has("thumb.webp") ? [paths.thumb] : []),
      ...(objects.has("display.webp") ? [paths.display] : []),
      ...(objects.has("poster.jpg") ? [paths.poster] : []),
    ]);
    return NextResponse.json({ error: oversizeMessage(media.original_filename || "This file", kind) }, { status: 413 });
  }
  const { data: updated, error } = await admin
    .from("media")
    .update({
      status: "ready",
      width: parsed.data.width,
      height: parsed.data.height,
      duration_seconds: parsed.data.durationSeconds,
      captured_at: parsed.data.capturedAt,
      byte_size: byteSize,
      thumb_path: objects.has("thumb.webp") ? paths.thumb : null,
      display_path: objects.has("display.webp") ? paths.display : null,
      poster_path: objects.has("poster.jpg") ? paths.poster : null,
    })
    .eq("id", mediaId)
    .neq("status", "ready")
    .select("id");
  if (error) return NextResponse.json({ error: "Could not finish the upload" }, { status: 500 });
  // A parallel retry already finished the row. Counting it again would inflate
  // the guest link's tally. Face enqueue below is safe to repeat.
  if (!updated?.length) {
    await indexFaces(media.event_id, mediaId);
    return NextResponse.json({ ok: true });
  }

  await recordGuestUpload(session.linkId, byteSize);
  // The R2 copy waits for the hourly backup drain. See the member finalize route.
  kickPlanNotices(media.event_id);
  if (media.kind === "video" && (!objects.has("poster.jpg") || parsed.data.durationSeconds == null)) kickVideoPreviews();
  await indexFaces(media.event_id, mediaId);

  return NextResponse.json({ ok: true });
}

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

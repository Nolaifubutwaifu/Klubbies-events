import { NextResponse } from "next/server";
import { z } from "zod";
import { clubFacesEnabled } from "@/lib/faces/collections";
import { enqueueMediaJob, kickFaceJobs } from "@/lib/faces/jobs";
import { recordGuestUpload, resolveGuestLink } from "@/lib/guest/links";
import { derivativePaths, listFolder } from "@/lib/storage";
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
    .select("id, club_id, storage_path, byte_size, guest_link_id")
    .eq("id", mediaId)
    .eq("guest_link_id", session.linkId)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.failed) {
    await admin.from("media").update({ status: "failed" }).eq("id", mediaId);
    return NextResponse.json({ ok: true });
  }

  const folder = media.storage_path.slice(0, media.storage_path.lastIndexOf("/"));
  const originalName = media.storage_path.slice(folder.length + 1);
  const objects = await listFolder(admin, folder);
  if (!objects.has(originalName)) {
    return NextResponse.json({ error: "The original file has not finished uploading" }, { status: 409 });
  }

  const paths = derivativePaths(folder);
  const byteSize = objects.get(originalName) || media.byte_size || 0;
  const { error } = await admin
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
    .eq("id", mediaId);
  if (error) return NextResponse.json({ error: "Could not finish the upload" }, { status: 500 });

  await recordGuestUpload(session.linkId, byteSize);

  // Face recognition, when the club has turned it on. Wrapped so it can never
  // fail the upload: a missing face job is a nuisance, a failed upload is not.
  // The drain is kicked here rather than left to the hourly cron, or "Photos of
  // you" would lag by up to an hour and read as broken.
  try {
    if (await clubFacesEnabled(media.club_id)) {
      await enqueueMediaJob(media.club_id, mediaId);
      kickFaceJobs();
    }
  } catch (faceError) {
    console.error("could not queue face indexing", mediaId, faceError);
  }

  return NextResponse.json({ ok: true });
}

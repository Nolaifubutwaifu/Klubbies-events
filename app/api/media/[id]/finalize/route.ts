import { NextResponse } from "next/server";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { clubFacesEnabled } from "@/lib/faces/collections";
import { enqueueMediaJob, kickFaceJobs } from "@/lib/faces/jobs";
import { derivativePaths, listFolder } from "@/lib/storage";
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
  const club = await getClubContextById(media.club_id);
  if (!club?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.failed) {
    await supabase.from("media").update({ status: "failed" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  const folder = media.storage_path.slice(0, media.storage_path.lastIndexOf("/"));
  const originalName = media.storage_path.slice(folder.length + 1);
  const objects = await listFolder(supabase, folder);
  if (!objects.has(originalName)) {
    return NextResponse.json({ error: "The original file has not finished uploading" }, { status: 409 });
  }

  const paths = derivativePaths(folder);
  const { width, height, durationSeconds, capturedAt } = parsed.data;
  const { error } = await supabase
    .from("media")
    .update({
      status: "ready",
      width,
      height,
      duration_seconds: durationSeconds,
      captured_at: capturedAt,
      byte_size: objects.get(originalName) || media.byte_size,
      thumb_path: objects.has("thumb.webp") ? paths.thumb : null,
      display_path: objects.has("display.webp") ? paths.display : null,
      poster_path: objects.has("poster.jpg") ? paths.poster : null,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Could not finish the upload" }, { status: 500 });

  // Face recognition, when the club has turned it on. Wrapped so it can never
  // fail the upload: a missing face job is a nuisance, a failed upload is not.
  // The drain is kicked here rather than left to the hourly cron, or "Photos of
  // you" would lag by up to an hour and read as broken.
  try {
    if (await clubFacesEnabled(media.club_id)) {
      await enqueueMediaJob(media.club_id, id);
      kickFaceJobs();
    }
  } catch (faceError) {
    console.error("could not queue face indexing", id, faceError);
  }

  return NextResponse.json({ ok: true });
}

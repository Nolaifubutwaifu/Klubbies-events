import { NextResponse } from "next/server";
import { z } from "zod";
import { displayNameFor } from "@/lib/auth/display-name";
import { getEventContextById } from "@/lib/auth/session";
import { MAX_VIDEO_BYTES } from "@/lib/billing/plans";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import { PHOTOGRAPHER_FULL_MESSAGE, PHOTOS_FULL } from "@/lib/billing/usage";
import { ACCEPTED_TYPES, resolveMimeType, VIDEO_TOO_BIG } from "@/lib/media/constants";
import { contentHashSchema, findExistingUpload, isUniqueViolation, type ExistingUpload } from "@/lib/media/dedupe";
import { BUCKET, derivativePaths, mediaFolder } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  albumId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().max(100).default(""),
  byteSize: z.number().int().positive(),
  contentHash: contentHashSchema,
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  const { albumId, filename, byteSize, contentHash } = parsed.data;

  const mimeType = resolveMimeType(filename, parsed.data.mimeType);
  if (!mimeType) {
    return NextResponse.json({ error: "Only JPG, PNG, HEIC, WebP, MP4 and MOV files can be uploaded" }, { status: 415 });
  }

  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, contributor_scope").eq("id", albumId).maybeSingle();
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

  // Organisers and Photographers upload anywhere; attendees only into albums
  // that invite them. RLS (can_contribute_to_album) says the same thing.
  const ctx = await getEventContextById(album.event_id);
  const allowed = ctx && !ctx.accessClosed && !ctx.paused && (ctx.perms.upload || (album.contributor_scope === "members" && ctx.membership));
  if (!ctx || !allowed) return NextResponse.json({ error: "Album not found" }, { status: 404 });
  if (!canWrite(ctx.event)) return NextResponse.json({ error: ACTIVATE_MESSAGE }, { status: 402 });

  const { kind, ext } = ACCEPTED_TYPES[mimeType];
  if (kind === "video" && byteSize > MAX_VIDEO_BYTES) return NextResponse.json({ error: VIDEO_TOO_BIG }, { status: 413 });
  const answer = (existing: ExistingUpload) => {
    // Already here and finished: the second copy is the bug this prevents.
    if (existing.status === "ready") return NextResponse.json({ duplicate: true, mediaId: existing.id });
    // Started before and never finished: carry on into the same row, so the
    // retry fixes the stuck file instead of sitting beside it.
    const folder = existing.storagePath.slice(0, existing.storagePath.lastIndexOf("/"));
    return NextResponse.json({
      mediaId: existing.id,
      kind,
      bucket: BUCKET,
      mimeType,
      storagePath: existing.storagePath,
      derivatives: derivativePaths(folder),
    });
  };

  const existing = await findExistingUpload(supabase, album.id, contentHash);
  if (existing) {
    if (existing.status === "failed") await supabase.from("media").update({ status: "processing" }).eq("id", existing.id);
    return answer(existing);
  }

  const id = crypto.randomUUID();
  const folder = mediaFolder(album.event_id, album.id, id);
  const storagePath = `${folder}/original.${ext}`;

  const { error } = await supabase.from("media").insert({
    id,
    event_id: album.event_id,
    album_id: album.id,
    kind,
    storage_path: storagePath,
    byte_size: byteSize,
    mime_type: mimeType,
    original_filename: filename,
    uploaded_by: ctx.userId,
    photographer_name: (await displayNameFor(ctx)) || null,
    status: "processing",
    content_hash: contentHash,
  });
  if (isUniqueViolation(error)) {
    // Two tabs dropped the same file at once and the other one won.
    const winner = await findExistingUpload(supabase, album.id, contentHash);
    if (winner) return answer(winner);
  }
  if (error?.code === PHOTOS_FULL) {
    const message = ctx.perms.manage_albums
      ? `This event has reached its limit of ${ctx.event.photo_limit ?? 0} photos. Delete some, or change the event's plan, to add more.`
      : PHOTOGRAPHER_FULL_MESSAGE;
    return NextResponse.json({ error: message, full: true }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: "Could not start the upload" }, { status: 500 });

  return NextResponse.json({
    mediaId: id,
    kind,
    bucket: BUCKET,
    mimeType,
    storagePath,
    derivatives: derivativePaths(folder),
  });
}

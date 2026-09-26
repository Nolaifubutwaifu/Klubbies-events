import "server-only";
import { DeleteFacesCommand, IndexFacesCommand, type FaceRecord } from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectionIdFor, faceClient, mediaExternalId } from "./client";
import { FACE_FLOORS, MAX_FACES_PER_PHOTO, QUALITY_FILTER, TRANSCODE_MAX_EDGE, TRANSCODE_QUALITY } from "./constants";

export type IndexResult = { faces: number; skipped?: string };

// Indexing and matching are separate steps on purpose. Matching used to run
// per photo, one Rekognition search per detected face, which made a photo cost
// about 3.2 calls rather than 1 on a library averaging 2.2 faces. The drain
// now indexes a whole batch and matches it once, from whichever side is
// cheaper — see lib/faces/match.ts.

/**
 * Rekognition accepts JPEG and PNG only, and our display derivatives are
 * WebP, so this is mandatory rather than an optimisation. Downscaling also
 * keeps the request well inside the 5 MB inline-bytes limit.
 */
async function toJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const out = await sharp(bytes)
    .rotate()
    .resize(TRANSCODE_MAX_EDGE, TRANSCODE_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: TRANSCODE_QUALITY })
    .toBuffer();
  return new Uint8Array(out);
}

/** Our own floors, on top of Rekognition's QualityFilter. */
function clearsFloors(record: FaceRecord): boolean {
  const detail = record.Face;
  const quality = record.FaceDetail?.Quality;
  const width = detail?.BoundingBox?.Width ?? 0;
  if (width < FACE_FLOORS.minBoundingBoxWidth) return false;
  if ((quality?.Sharpness ?? 0) < FACE_FLOORS.minSharpness) return false;
  if ((quality?.Brightness ?? 0) < FACE_FLOORS.minBrightness) return false;
  return true;
}

/**
 * Indexes one photo. Writing the matches is the caller's job, once per batch.
 *
 * Re-running must not double-index, so existing media_faces for this photo go
 * first. Their `before delete` trigger queues the Rekognition ids for
 * deletion, so nothing leaks — and face_rejections survives, because it is
 * keyed on (profile, media) rather than on the face row.
 */
export async function indexMedia(clubId: string, mediaId: string): Promise<IndexResult> {
  const client = faceClient();
  if (!client) return { faces: 0, skipped: "aws not configured" };

  const admin = createAdminClient();
  const collectionId = collectionIdFor(clubId);

  const { data: media } = await admin
    .from("media")
    .select("id, club_id, kind, status, storage_path, display_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media) return { faces: 0, skipped: "media gone" };
  if (media.kind !== "photo" || media.status !== "ready") {
    return { faces: 0, skipped: `not a ready photo (${media.kind}/${media.status})` };
  }

  const path = media.display_path ?? media.storage_path;
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !blob) throw new Error(`could not download ${path}: ${downloadError?.message ?? "no body"}`);
  const jpeg = await toJpeg(new Uint8Array(await blob.arrayBuffer()));

  // Idempotency: the old rows go before the new ones are created.
  await admin.from("media_faces").delete().eq("media_id", mediaId);

  const indexed = await client.send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: jpeg },
      ExternalImageId: mediaExternalId(mediaId),
      QualityFilter: QUALITY_FILTER,
      MaxFaces: MAX_FACES_PER_PHOTO,
      DetectionAttributes: [],
    }),
  );

  const records = indexed.FaceRecords ?? [];
  const kept = records.filter(clearsFloors);
  const dropped = records.filter((r) => !clearsFloors(r));

  // Faces that failed our floors were stored by IndexFaces regardless, so
  // they go straight back out: no point paying to keep a faceprint we have
  // already decided not to trust.
  const droppedIds = dropped.map((r) => r.Face?.FaceId).filter((id): id is string => Boolean(id));
  if (droppedIds.length) {
    await client
      .send(new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: droppedIds }))
      .catch((error) => console.error("could not delete sub-threshold faces", mediaId, error));
  }

  if (kept.length === 0) return { faces: 0 };

  const rows = kept.map((record) => ({
    club_id: clubId,
    media_id: mediaId,
    collection_id: collectionId,
    rekognition_face_id: record.Face!.FaceId!,
    bounding_box: record.Face!.BoundingBox as unknown as Record<string, number>,
    confidence: record.Face?.Confidence ?? null,
    sharpness: record.FaceDetail?.Quality?.Sharpness ?? null,
    brightness: record.FaceDetail?.Quality?.Brightness ?? null,
  }));
  const { error: insertError } = await admin.from("media_faces").insert(rows);
  if (insertError) throw insertError;

  return { faces: kept.length };
}

/**
 * A `rematch_media` job re-scores a photo whose faces are already indexed —
 * which is what tuning the similarity bands needs, and it costs no download,
 * no transcode and no IndexFaces. There is nothing to do here: the drain
 * hands every photo in the batch to the matcher regardless of how it got
 * there, so this only has to confirm the faces still exist.
 */
export async function rematchMedia(clubId: string, mediaId: string): Promise<IndexResult> {
  const { count } = await createAdminClient()
    .from("media_faces")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("media_id", mediaId);
  return { faces: count ?? 0 };
}

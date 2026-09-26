import "server-only";
import { CreateCollectionCommand, DescribeCollectionCommand } from "@aws-sdk/client-rekognition";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectionIdFor, faceClient } from "./client";

// One collection per club, holding media faces and enrolled reference faces
// together, told apart by ExternalImageId. Two collections would look tidier
// and break the design: SearchFaces can only search the collection a FaceId
// lives in, so splitting them forces an image-bytes search per face.

/** Idempotent: an existing collection is left exactly as it is. */
export async function ensureClubCollection(clubId: string): Promise<string | null> {
  const client = faceClient();
  if (!client) return null;
  const collectionId = collectionIdFor(clubId);
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: collectionId }));
  } catch (error) {
    if ((error as { name?: string })?.name !== "ResourceAlreadyExistsException") throw error;
  }
  return collectionId;
}

export async function collectionFaceCount(collectionId: string): Promise<number | null> {
  const client = faceClient();
  if (!client) return null;
  try {
    const out = await client.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    return out.FaceCount ?? 0;
  } catch {
    return null;
  }
}

export type ClubFaceState = {
  enabled: boolean;
  collectionId: string | null;
  backfillStatus: string;
  noticeAcceptedAt: string | null;
};

/** The club's switch, read with the service role. Null when never considered. */
export async function clubFaceState(clubId: string): Promise<ClubFaceState | null> {
  const { data } = await createAdminClient()
    .from("club_face_settings")
    .select("enabled, collection_id, backfill_status, notice_accepted_at")
    .eq("club_id", clubId)
    .maybeSingle();
  if (!data) return null;
  return {
    enabled: data.enabled,
    collectionId: data.collection_id,
    backfillStatus: data.backfill_status,
    noticeAcceptedAt: data.notice_accepted_at,
  };
}

/**
 * Cheap guard for the upload hot path: is this club indexing faces at all?
 * Enabled is enough. A club turned on by the rollout has no collection until
 * the drain's first pass makes one, and its uploads should queue meanwhile.
 */
export async function clubFacesEnabled(clubId: string): Promise<boolean> {
  const state = await clubFaceState(clubId);
  return Boolean(state?.enabled);
}

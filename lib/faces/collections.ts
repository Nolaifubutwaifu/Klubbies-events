import "server-only";
import { CreateCollectionCommand, DescribeCollectionCommand } from "@aws-sdk/client-rekognition";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectionIdFor, faceClient } from "./client";

// One collection per event, holding media faces and enrolled reference faces
// together, told apart by ExternalImageId. Two collections would look tidier
// and break the design: SearchFaces can only search the collection a FaceId
// lives in, so splitting them forces an image-bytes search per face.

/** Idempotent: an existing collection is left exactly as it is. */
export async function ensureEventCollection(eventId: string): Promise<string | null> {
  const client = faceClient();
  if (!client) return null;
  const collectionId = collectionIdFor(eventId);
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

export type EventFaceState = {
  enabled: boolean;
  collectionId: string | null;
  backfillStatus: string;
  noticeAcceptedAt: string | null;
};

/** The event's switch, read with the service role. Null when never considered. */
export async function eventFaceState(eventId: string): Promise<EventFaceState | null> {
  const { data } = await createAdminClient()
    .from("event_face_settings")
    .select("enabled, collection_id, backfill_status, notice_accepted_at")
    .eq("event_id", eventId)
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
 * Cheap guard for the upload hot path: is this event indexing faces at all?
 * Enabled is enough. A event turned on by the rollout has no collection until
 * the drain's first pass makes one, and its uploads should queue meanwhile.
 */
export async function eventFacesEnabled(eventId: string): Promise<boolean> {
  const state = await eventFaceState(eventId);
  return Boolean(state?.enabled);
}

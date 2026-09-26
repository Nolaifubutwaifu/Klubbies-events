import "server-only";
import { DeleteCollectionCommand, DeleteFacesCommand } from "@aws-sdk/client-rekognition";
import { createAdminClient } from "@/lib/supabase/admin";
import { faceClient } from "./client";
import { PURGE_BATCH_SIZE } from "./constants";

// The failure mode this file exists for: the Postgres row is deleted and the
// faceprint stays in AWS. Nothing in the database will ever tell you it
// happened, which is the difference between a tidy schema and a compliance
// failure. Every delete path reaches Rekognition, and the purge queue is what
// makes that survive a cascade.

export type PurgeResult = { queued: number; deleted: number; failed: number };

/**
 * Drains face_purge_queue against Rekognition. A face id that no longer
 * exists comes back as a success, so re-running is always safe. Rows are
 * removed only after AWS confirms.
 */
export async function drainFacePurgeQueue(limit = PURGE_BATCH_SIZE * 4): Promise<PurgeResult> {
  const client = faceClient();
  if (!client) return { queued: 0, deleted: 0, failed: 0 };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("face_purge_queue")
    .select("id, collection_id, rekognition_face_id, attempts")
    .lt("attempts", 5)
    .order("id")
    .limit(limit);

  const pending = rows ?? [];
  if (pending.length === 0) return { queued: 0, deleted: 0, failed: 0 };

  // One DeleteFaces call per collection, because the API takes a single
  // CollectionId and a list of face ids.
  const byCollection = new Map<string, typeof pending>();
  for (const row of pending) {
    const list = byCollection.get(row.collection_id) ?? [];
    list.push(row);
    byCollection.set(row.collection_id, list);
  }

  let deleted = 0;
  let failed = 0;

  for (const [collectionId, all] of byCollection) {
    for (let i = 0; i < all.length; i += PURGE_BATCH_SIZE) {
      const chunk = all.slice(i, i + PURGE_BATCH_SIZE);
      try {
        await client.send(
          new DeleteFacesCommand({
            CollectionId: collectionId,
            FaceIds: chunk.map((row) => row.rekognition_face_id),
          }),
        );
        await admin
          .from("face_purge_queue")
          .delete()
          .in(
            "id",
            chunk.map((row) => row.id),
          );
        deleted += chunk.length;
      } catch (error) {
        // A collection that is already gone took its faces with it.
        if ((error as { name?: string })?.name === "ResourceNotFoundException") {
          await admin
            .from("face_purge_queue")
            .delete()
            .in(
              "id",
              chunk.map((row) => row.id),
            );
          deleted += chunk.length;
          continue;
        }
        failed += chunk.length;
        console.error("face purge failed", collectionId, error);
        for (const row of chunk) {
          await admin
            .from("face_purge_queue")
            .update({ attempts: row.attempts + 1 })
            .eq("id", row.id);
        }
      }
    }
  }

  return { queued: pending.length, deleted, failed };
}

/**
 * Turning the feature off for a club. One call removes every faceprint the
 * club ever had, which is why the notice can promise exactly that.
 */
export async function deleteClubCollection(collectionId: string): Promise<void> {
  const client = faceClient();
  if (!client) return;
  try {
    await client.send(new DeleteCollectionCommand({ CollectionId: collectionId }));
  } catch (error) {
    if ((error as { name?: string })?.name === "ResourceNotFoundException") return;
    throw error;
  }
}

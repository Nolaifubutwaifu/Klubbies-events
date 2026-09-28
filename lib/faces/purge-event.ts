import "server-only";
import { removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteEventCollection } from "./purge";

/**
 * Deletes every piece of an event's face data and turns face search off:
 * the selfies, every faceprint (the whole AWS collection in one call), the
 * matches and the queued jobs. Used when an organiser turns face search off,
 * when a gallery closes (privacy page: within 24 hours), and at the 12 month
 * deletion. Returns false if AWS didn't confirm, so the caller can retry.
 */
export async function deleteEventFaceData(eventId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: settings } = await admin.from("event_face_settings").select("collection_id").eq("event_id", eventId).maybeSingle();

  const { data: profiles } = await admin.from("member_face_profiles").select("id, selfie_path").eq("event_id", eventId);
  const selfies = (profiles ?? []).map((p) => p.selfie_path).filter((p): p is string => Boolean(p));

  // Rows first. The purge triggers will queue every face id, which is belt
  // and braces: DeleteCollection below takes them all in one call anyway.
  await admin.from("face_jobs").delete().eq("event_id", eventId);
  await admin.from("member_face_profiles").delete().eq("event_id", eventId);
  await admin.from("media_faces").delete().eq("event_id", eventId);

  if (settings?.collection_id) {
    try {
      await deleteEventCollection(settings.collection_id);
      // The collection is gone, so its queued ids are already dead.
      await admin.from("face_purge_queue").delete().eq("collection_id", settings.collection_id);
    } catch (error) {
      console.error("could not delete face collection", eventId, error);
      return false;
    }
  }

  if (selfies.length) {
    await removeObjects(selfies).catch((error) => console.error("could not remove selfies", eventId, error));
  }

  await admin
    .from("event_face_settings")
    .update({
      enabled: false,
      collection_id: null,
      backfill_status: "idle",
      backfill_queued_at: null,
      backfill_completed_at: null,
    })
    .eq("event_id", eventId);
  return true;
}

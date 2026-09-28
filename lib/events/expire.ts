import "server-only";
import { deleteEventFaceData } from "@/lib/faces/purge-event";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The 12 month deletion (docs/handoff-retention-backups.md, phase 3). Deletes
 * the event's photos and previews (Recently deleted included), album covers,
 * selfies and faceprints, the guest list and the access log. Keeps the event
 * row, its organisers, payments and usage totals, so invoices and cost
 * figures survive and organisers see when the photos went. Straight to
 * deletion, never the bin: the organiser was warned twice. The R2 copies go
 * 30 days later, through removeObjects.
 *
 * Safe to run again: photos_deleted_at is stamped only at the end.
 */
export async function expireEventPhotos(eventId: string): Promise<void> {
  const admin = createAdminClient();

  if (!(await deleteEventFaceData(eventId))) throw new Error(`face data for ${eventId} not confirmed deleted`);

  for (;;) {
    const { data: batch } = await admin
      .from("media")
      .select("id, storage_path, thumb_path, display_path, poster_path")
      .eq("event_id", eventId)
      .limit(500);
    if (!batch || batch.length === 0) break;
    await removeObjects(batch.flatMap((m) => [m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p))));
    const { error } = await admin.from("media").delete().in("id", batch.map((m) => m.id));
    if (error) throw error;
  }

  const { data: albums } = await admin.from("albums").select("id, cover_path").eq("event_id", eventId);
  const covers = (albums ?? []).map((a) => a.cover_path).filter((p): p is string => Boolean(p));
  if (covers.length) await removeObjects(covers);
  await admin.from("albums").delete().eq("event_id", eventId);

  // The guest list: everyone but the people who run the event.
  const { data: members } = await admin.from("memberships").select("id, role, event_roles(manage_event)").eq("event_id", eventId);
  const guests = (members ?? []).filter((m) => m.role !== "event_admin" && !m.event_roles?.manage_event).map((m) => m.id);
  for (let i = 0; i < guests.length; i += 500) {
    await admin.from("memberships").delete().in("id", guests.slice(i, i + 500));
  }
  await admin.from("roster_imports").delete().eq("event_id", eventId);
  await admin.from("access_events").delete().eq("event_id", eventId);
  await admin.from("pending_sign_ins").delete().eq("event_id", eventId);

  await drainFacePurgeQueue().catch((error) => console.error("face purge after expiry", error));
  const now = new Date().toISOString();
  const { error } = await admin.from("events").update({ photos_deleted_at: now, face_data_closed_at: now }).eq("id", eventId);
  if (error) throw error;
}

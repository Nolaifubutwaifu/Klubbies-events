import "server-only";
import { deleteEventCollection } from "@/lib/faces/purge";
import { logoMarkPath, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes an event for good: its faceprints in AWS, every file in storage,
 * then the row, which cascades to albums, media, attendees and the log.
 * Used by "Delete this event" in Settings, and when the only organiser of an
 * event nobody joined deletes their account.
 */
export async function deleteEventEverywhere(eventId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, logo_path").eq("id", eventId).maybeSingle();
  if (!event) return;

  const { data: settings } = await admin.from("event_face_settings").select("collection_id").eq("event_id", eventId).maybeSingle();
  if (settings?.collection_id) {
    await deleteEventCollection(settings.collection_id);
    await admin.from("face_purge_queue").delete().eq("collection_id", settings.collection_id);
  }

  // Files first, a page at a time: a big event has far more than one
  // request's worth of rows. Any failed read or removal stops here with the
  // row still in place, so the next try (the hourly bin purge, or the button
  // again) can find the files. Deleting the row first left them orphaned.
  const paths: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: media, error } = await admin
      .from("media")
      .select("storage_path, thumb_path, display_path, poster_path")
      .eq("event_id", eventId)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const m of media) paths.push(...[m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p)));
    if (media.length < 1000) break;
  }
  const { data: albums, error: albumsError } = await admin.from("albums").select("cover_path").eq("event_id", eventId);
  if (albumsError) throw albumsError;
  for (const a of albums) if (a.cover_path) paths.push(a.cover_path);
  const { data: selfies, error: selfiesError } = await admin.from("member_face_profiles").select("selfie_path").eq("event_id", eventId);
  if (selfiesError) throw selfiesError;
  for (const s of selfies) if (s.selfie_path) paths.push(s.selfie_path);
  if (event.logo_path) paths.push(event.logo_path, logoMarkPath(event.logo_path));

  // removeObjects throws on a failed batch and queues the R2 copies.
  await removeObjects(paths);
  const { error } = await admin.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

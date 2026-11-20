import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { zipPartSummaries } from "./zip-parts";

type UserClient = Awaited<ReturnType<typeof createClient>>;

function distinctNames(rows: { photographer_name: string | null }[] | null): string[] {
  return [...new Set((rows ?? []).map((row) => row.photographer_name?.trim()).filter((name): name is string => Boolean(name)))].sort();
}

/**
 * What the album page counts, in one pass over the album (migration 45):
 * ready photos and videos, the zip part sizes, who took and who uploaded the
 * files, and whether a photographer link added any.
 */
export async function albumPageSummary(supabase: UserClient, albumId: string) {
  const { data, error } = await supabase.rpc("album_page_summary", { p_album_id: albumId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    photoCount: row?.photo_count ?? 0,
    videoCount: row?.video_count ?? 0,
    zipParts: zipPartSummaries((row?.sizes ?? []).map((byteSize) => ({ byteSize }))),
    credits: [...(row?.photographer_names ?? [])].sort(),
    uploaderIds: row?.uploader_ids ?? [],
    hasGuestFiles: row?.has_guest_files ?? false,
  };
}

/** Every photographer credited in an event, for "Photos by ..." on its home. */
export async function eventPhotographers(supabase: UserClient, eventId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("event_photographers", { p_event_id: eventId });
  if (!error && Array.isArray(data)) return [...data].sort();
  const { data: rows } = await supabase.from("media").select("photographer_name").eq("event_id", eventId).not("photographer_name", "is", null).limit(2000);
  return distinctNames(rows);
}

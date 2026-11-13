import "server-only";
import type { createClient } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof createClient>>;

function distinctNames(rows: { photographer_name: string | null }[] | null): string[] {
  return [...new Set((rows ?? []).map((row) => row.photographer_name?.trim()).filter((name): name is string => Boolean(name)))].sort();
}

/**
 * Who took an album's photos and who uploaded them, as distinct values from
 * the database (migration 38). Until that migration is applied the function
 * doesn't exist, so this falls back to reading the rows, as it always did.
 */
export async function albumCredits(supabase: UserClient, albumId: string): Promise<{ credits: string[]; uploaderIds: string[] }> {
  const { data, error } = await supabase.rpc("album_credits", { p_album_id: albumId });
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row) return { credits: [...(row.photographer_names ?? [])].sort(), uploaderIds: row.uploader_ids ?? [] };

  const [{ data: creditRows }, { data: uploaders }] = await Promise.all([
    supabase.from("media").select("photographer_name").eq("album_id", albumId).not("photographer_name", "is", null).limit(1000),
    supabase.from("media").select("uploaded_by").eq("album_id", albumId).not("uploaded_by", "is", null).limit(400),
  ]);
  return {
    credits: distinctNames(creditRows),
    uploaderIds: [...new Set((uploaders ?? []).map((m) => m.uploaded_by).filter((id): id is string => Boolean(id)))],
  };
}

/** Every photographer credited in an event, for "Photos by ..." on its home. */
export async function eventPhotographers(supabase: UserClient, eventId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("event_photographers", { p_event_id: eventId });
  if (!error && Array.isArray(data)) return [...data].sort();
  const { data: rows } = await supabase.from("media").select("photographer_name").eq("event_id", eventId).not("photographer_name", "is", null).limit(2000);
  return distinctNames(rows);
}

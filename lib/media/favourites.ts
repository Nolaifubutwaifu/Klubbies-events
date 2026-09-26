import "server-only";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

export type SavedItem = {
  id: string;
  kind: string;
  thumbUrl: string | null;
  albumId: string | null;
  durationSeconds: number | null;
};

export type SavedGroup = {
  albumId: string;
  albumTitle: string;
  albumDate: string | null;
  items: SavedItem[];
};

/** The caller's favourites in one club, newest first, grouped by album. */
export async function listFavourites(supabase: UserClient, clubId: string, userId: string): Promise<SavedGroup[]> {
  const { data: rows, error } = await supabase
    .from("favourites")
    .select("media_id, created_at, media(id, kind, album_id, thumb_path, poster_path, duration_seconds, status)")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const media = (rows ?? [])
    .map((row) => row.media)
    .filter((m): m is NonNullable<typeof m> => Boolean(m) && m!.status === "ready");
  if (!media.length) return [];

  const albumIds = [...new Set(media.map((m) => m.album_id).filter((id): id is string => Boolean(id)))];
  const { data: albums } = albumIds.length
    ? await supabase.from("albums").select("id, title, event_date").in("id", albumIds)
    : { data: [] };
  const albumById = new Map((albums ?? []).map((a) => [a.id, a]));

  const urls = await signPaths(
    supabase,
    media.map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );

  // Album order follows the favourites order: the album you last saved from
  // sits at the top.
  const groups = new Map<string, SavedGroup>();
  for (const item of media) {
    if (!item.album_id) continue;
    const album = albumById.get(item.album_id);
    if (!album) continue; // RLS hid it, or it was deleted
    const group =
      groups.get(item.album_id) ??
      { albumId: item.album_id, albumTitle: album.title, albumDate: album.event_date, items: [] };
    const path = item.thumb_path ?? item.poster_path;
    group.items.push({
      id: item.id,
      kind: item.kind,
      thumbUrl: path ? (urls.get(path) ?? null) : null,
      albumId: item.album_id,
      durationSeconds: item.duration_seconds,
    });
    groups.set(item.album_id, group);
  }

  return [...groups.values()];
}

/** Which of `mediaIds` the caller has favourited. */
export async function favouritedIds(supabase: UserClient, userId: string, mediaIds: string[]): Promise<Set<string>> {
  if (!mediaIds.length) return new Set();
  const { data } = await supabase
    .from("favourites")
    .select("media_id")
    .eq("user_id", userId)
    .in("media_id", mediaIds);
  return new Set((data ?? []).map((row) => row.media_id));
}

import "server-only";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

const TILES_PER_EVENT = 3;

/** n items spread evenly through a list, not the first n in a row. */
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)]);
}

export type EventCard = {
  tiles: string[];
  albumCount: number;
  itemCount: number;
  /** Albums published since this member last opened the event. */
  newCount: number;
  latestTitle: string | null;
  latestDate: string | null;
};

/**
 * The photo side of a event, for the event picker: a few recent thumbnails and
 * what has landed since the member last looked. Kept out of listMyEvents so the
 * app header doesn't pay for it on every page.
 */
export async function listEventCards(
  supabase: UserClient,
  eventIds: string[],
  userId: string,
): Promise<Map<string, EventCard>> {
  const cards = new Map<string, EventCard>();
  if (!eventIds.length) return cards;

  const [{ data: visits }, { data: albums }] = await Promise.all([
    supabase.from("memberships").select("event_id, last_seen_at").eq("user_id", userId).in("event_id", eventIds),
    supabase
      .from("albums")
      .select("id, event_id, title, album_date, published_at, cover_media_id, cover_path")
      .in("event_id", eventIds)
      .eq("status", "published")
      .order("album_date", { ascending: false, nullsFirst: false }),
  ]);

  const albumIds = (albums ?? []).map((a) => a.id);
  const { data: counts } = albumIds.length
    ? await supabase
        .from("album_media_counts")
        .select("album_id, photo_count, video_count, first_media_id")
        .in("album_id", albumIds)
    : { data: [] };
  const countRow = new Map((counts ?? []).map((c) => [c.album_id, c]));
  const countByAlbum = new Map(
    (counts ?? []).map((c) => [c.album_id, (c.photo_count ?? 0) + (c.video_count ?? 0)]),
  );

  const seenAt = new Map((visits ?? []).map((v) => [v.event_id, v.last_seen_at]));

  // The collage is made of album covers: they exist, the committee picked
  // them, and one per album means three different nights rather than three
  // frames of the same burst. It used to be the event's newest thumbnails
  // across one shared query, so a event with a big fresh album took every
  // slot and the others said "Previews still processing" for good.
  type Pick = { albumId: string; path?: string; mediaId?: string };
  const picks = new Map<string, Pick[]>();
  for (const album of albums ?? []) {
    const list = picks.get(album.event_id) ?? [];
    picks.set(album.event_id, list);
    if (list.length >= TILES_PER_EVENT || !countByAlbum.get(album.id)) continue;
    const mediaId = album.cover_media_id ?? countRow.get(album.id)?.first_media_id ?? undefined;
    if (album.cover_path) list.push({ albumId: album.id, path: album.cover_path });
    else if (mediaId) list.push({ albumId: album.id, mediaId });
  }

  // A event with fewer albums than tiles fills in from its newest album,
  // spread through it so the extra frames aren't near-duplicates either.
  const fillAlbums = [...picks.entries()]
    .filter(([, list]) => list.length > 0 && list.length < TILES_PER_EVENT)
    .map(([, list]) => list[0].albumId);
  const { data: fillMedia } = fillAlbums.length
    ? await supabase
        .from("media")
        .select("id, album_id, sort_at")
        .in("album_id", fillAlbums)
        .eq("status", "ready")
        .order("sort_at", { ascending: true })
        .limit(fillAlbums.length * 400)
    : { data: [] };
  for (const list of picks.values()) {
    if (list.length === 0 || list.length >= TILES_PER_EVENT) continue;
    const taken = new Set(list.map((p) => p.mediaId));
    const pool = (fillMedia ?? []).filter((m) => m.album_id === list[0].albumId && !taken.has(m.id));
    for (const m of spread(pool, TILES_PER_EVENT - list.length)) list.push({ albumId: list[0].albumId, mediaId: m.id });
  }

  const mediaIds = [...picks.values()].flat().flatMap((p) => (p.mediaId ? [p.mediaId] : []));
  const { data: thumbs } = mediaIds.length
    ? await supabase.from("media").select("id, thumb_path, poster_path").in("id", mediaIds)
    : { data: [] };
  const thumbById = new Map((thumbs ?? []).map((m) => [m.id, m.thumb_path ?? m.poster_path]));

  const pathsByEvent = new Map<string, string[]>();
  for (const [eventId, list] of picks) {
    pathsByEvent.set(
      eventId,
      list.map((p) => p.path ?? (p.mediaId ? thumbById.get(p.mediaId) : null)).filter((p): p is string => Boolean(p)),
    );
  }
  const urls = await signPaths(supabase, [...pathsByEvent.values()].flat(), SIGNED_URL_TTL.thumb);

  for (const eventId of eventIds) {
    const own = (albums ?? []).filter((a) => a.event_id === eventId);
    const since = seenAt.get(eventId);
    const cutoff = since ? new Date(since).getTime() : null;

    cards.set(eventId, {
      tiles: (pathsByEvent.get(eventId) ?? []).map((p) => urls.get(p)).filter((u): u is string => Boolean(u)),
      albumCount: own.length,
      itemCount: own.reduce((sum, a) => sum + (countByAlbum.get(a.id) ?? 0), 0),
      newCount:
        cutoff === null
          ? 0
          : own.filter((a) => a.published_at !== null && new Date(a.published_at).getTime() > cutoff).length,
      latestTitle: own[0]?.title ?? null,
      latestDate: own[0]?.album_date ?? null,
    });
  }

  return cards;
}

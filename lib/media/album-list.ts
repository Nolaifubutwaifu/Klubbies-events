import "server-only";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

export const TILES_PER_ALBUM = 6;

export type StackedAlbum = {
  id: string;
  title: string;
  description: string | null;
  date: string; // event date, else published, else created
  eventType: string | null;
  status: string;
  photoCount: number;
  videoCount: number;
  processingCount: number;
  allowDownload: boolean;
  openToMembers: boolean;
  coverUrl: string | null;
  /** The cover at display size (2000px). Only signed for the album the club
      home leads with, where the cover runs nearly the width of the page and
      the 400px thumbnail looked pixelated. */
  heroUrl: string | null;
  tiles: { id: string; url: string | null; kind: string }[];
  moreCount: number;
  /** Published since the viewer last opened this club. */
  isNew: boolean;
  /** Set when a draft is queued to publish itself. */
  publishAt: string | null;
  sortOrder: number;
};

/**
 * Every album the viewer may see, each with a strip of preview tiles, so the
 * events page can stack albums under each other and filter without a round
 * trip.
 */
export async function listStackedAlbums(
  supabase: UserClient,
  clubId: string,
  opts: { includeDrafts?: boolean; limit?: number; since?: string | null } = {},
): Promise<StackedAlbum[]> {
  const limit = opts.limit ?? 60;
  // A first visit has nothing to compare against, so nothing is "new".
  const since = opts.since ? new Date(opts.since).getTime() : null;
  let query = supabase
    .from("albums")
    .select(
      "id, title, description, event_date, event_type, status, created_at, published_at, publish_at, sort_order, allow_download, contributor_scope, cover_media_id, cover_path",
    )
    .eq("club_id", clubId)
    // An explicit order wins; everything still at 0 falls back to event date.
    .order("sort_order", { ascending: false })
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!opts.includeDrafts) query = query.eq("status", "published");

  const { data: albums, error } = await query;
  if (error) throw error;
  if (!albums?.length) return [];

  const ids = albums.map((a) => a.id);
  const [{ data: counts }, { data: media }] = await Promise.all([
    supabase.from("album_media_counts").select("*").in("album_id", ids),
    supabase
      .from("media")
      .select("id, album_id, kind, status, thumb_path, display_path, poster_path, sort_at")
      .in("album_id", ids)
      .order("album_id")
      .order("sort_at", { ascending: true })
      .limit(ids.length * 12),
  ]);

  const countByAlbum = new Map((counts ?? []).map((c) => [c.album_id, c]));
  const byAlbum = new Map<string, typeof media>();
  for (const item of media ?? []) {
    if (!item.album_id) continue;
    const list = byAlbum.get(item.album_id) ?? [];
    if (list.length < TILES_PER_ALBUM + 1 && item.status === "ready") list.push(item);
    byAlbum.set(item.album_id, list);
  }

  const coverMediaIds = albums.map((a) => a.cover_media_id).filter((id): id is string => Boolean(id));
  const { data: coverMedia } = coverMediaIds.length
    ? await supabase.from("media").select("id, thumb_path, display_path, poster_path").in("id", coverMediaIds)
    : { data: [] };
  const coverById = new Map((coverMedia ?? []).map((m) => [m.id, m.thumb_path ?? m.poster_path]));
  const coverDisplayById = new Map((coverMedia ?? []).map((m) => [m.id, m.display_path ?? m.poster_path]));

  // The same pick SoftEvents makes: the newest album with something in it and
  // something to show. Only that one needs its big rendition signed.
  const hero = albums.find((album) => {
    const count = countByAlbum.get(album.id);
    const total = (count?.photo_count ?? 0) + (count?.video_count ?? 0);
    return total > 0 && (album.cover_path || album.cover_media_id || byAlbum.get(album.id)?.length);
  });
  const heroFirst = hero ? byAlbum.get(hero.id)?.[0] : undefined;
  const heroPath = hero
    ? (hero.cover_path ??
      (hero.cover_media_id ? coverDisplayById.get(hero.cover_media_id) : null) ??
      heroFirst?.display_path ??
      heroFirst?.poster_path ??
      null)
    : null;
  const heroUrls = heroPath ? await signPaths(supabase, [heroPath], SIGNED_URL_TTL.display) : new Map<string, string>();

  const paths = [
    ...(media ?? []).map((m) => m.thumb_path ?? m.poster_path ?? ""),
    ...albums.map((a) => a.cover_path ?? ""),
    ...[...coverById.values()].map((p) => p ?? ""),
  ].filter(Boolean);
  const urls = await signPaths(supabase, paths, SIGNED_URL_TTL.thumb);

  return albums.map((album) => {
    const count = countByAlbum.get(album.id);
    const tilesSource = (byAlbum.get(album.id) ?? []).slice(0, TILES_PER_ALBUM);
    const total = (count?.photo_count ?? 0) + (count?.video_count ?? 0);
    const coverPath = album.cover_path ?? (album.cover_media_id ? coverById.get(album.cover_media_id) : null);
    const firstTileUrl = tilesSource[0] ? urls.get(tilesSource[0].thumb_path ?? tilesSource[0].poster_path ?? "") : null;

    return {
      id: album.id,
      title: album.title,
      description: album.description,
      date: album.event_date ?? album.published_at ?? album.created_at,
      eventType: album.event_type,
      status: album.status,
      photoCount: count?.photo_count ?? 0,
      videoCount: count?.video_count ?? 0,
      processingCount: 0,
      allowDownload: album.allow_download,
      openToMembers: album.contributor_scope === "members",
      coverUrl: (coverPath ? urls.get(coverPath) : null) ?? firstTileUrl ?? null,
      heroUrl: album.id === hero?.id && heroPath ? (heroUrls.get(heroPath) ?? null) : null,
      tiles: tilesSource.map((t) => ({
        id: t.id,
        kind: t.kind,
        url: urls.get(t.thumb_path ?? t.poster_path ?? "") ?? null,
      })),
      moreCount: Math.max(0, total - tilesSource.length),
      publishAt: album.publish_at,
      sortOrder: album.sort_order,
      isNew:
        since !== null &&
        album.status === "published" &&
        album.published_at !== null &&
        new Date(album.published_at).getTime() > since,
    };
  });
}

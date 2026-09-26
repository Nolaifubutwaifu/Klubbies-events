import "server-only";
import type { Album, Media } from "@/lib/db/types";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

export const ALBUM_PAGE_SIZE = 48;
export const MEDIA_PAGE_SIZE = 60;

export type AlbumCard = Pick<
  Album,
  "id" | "title" | "description" | "event_date" | "status" | "created_at" | "allow_download" | "published_at"
> & {
  photoCount: number;
  videoCount: number;
  coverUrl: string | null;
};

export type GridItem = Pick<Media, "id" | "kind" | "width" | "height" | "duration_seconds" | "status" | "original_filename"> & {
  thumbUrl: string | null;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function listAlbums(
  supabase: UserClient,
  clubId: string,
  opts: { q?: string; kind?: "photo" | "video"; includeDrafts?: boolean; page?: number },
): Promise<{ albums: AlbumCard[]; hasMore: boolean }> {
  const page = Math.max(0, opts.page ?? 0);
  let query = supabase
    .from("albums")
    .select("id, title, description, event_date, status, created_at, published_at, allow_download, cover_media_id")
    .eq("club_id", clubId)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(page * ALBUM_PAGE_SIZE, (page + 1) * ALBUM_PAGE_SIZE); // one extra row to detect more

  if (!opts.includeDrafts) query = query.eq("status", "published");
  if (opts.q) query = query.ilike("title", `%${escapeLike(opts.q)}%`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > ALBUM_PAGE_SIZE;
  const albums = rows.slice(0, ALBUM_PAGE_SIZE);
  if (albums.length === 0) return { albums: [], hasMore: false };

  const { data: counts } = await supabase
    .from("album_media_counts")
    .select("*")
    .in(
      "album_id",
      albums.map((a) => a.id),
    );
  const countByAlbum = new Map((counts ?? []).map((c) => [c.album_id, c]));

  const coverIds = albums
    .map((a) => a.cover_media_id ?? countByAlbum.get(a.id)?.first_media_id ?? null)
    .filter((id): id is string => Boolean(id));
  const { data: covers } = coverIds.length
    ? await supabase.from("media").select("id, thumb_path, poster_path").in("id", coverIds)
    : { data: [] };
  const coverPath = new Map((covers ?? []).map((c) => [c.id, c.thumb_path ?? c.poster_path]));
  const urls = await signPaths(
    supabase,
    [...coverPath.values()].filter((p): p is string => Boolean(p)),
    SIGNED_URL_TTL.thumb,
  );

  const cards = albums.map((a) => {
    const count = countByAlbum.get(a.id);
    const coverId = a.cover_media_id ?? count?.first_media_id ?? null;
    const path = coverId ? coverPath.get(coverId) : null;
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      event_date: a.event_date,
      status: a.status,
      created_at: a.created_at,
      published_at: a.published_at,
      allow_download: a.allow_download,
      photoCount: count?.photo_count ?? 0,
      videoCount: count?.video_count ?? 0,
      coverUrl: path ? (urls.get(path) ?? null) : null,
    };
  });

  const filtered =
    opts.kind === "photo"
      ? cards.filter((c) => c.photoCount > 0)
      : opts.kind === "video"
        ? cards.filter((c) => c.videoCount > 0)
        : cards;

  return { albums: filtered, hasMore };
}

export async function listAlbumMedia(
  supabase: UserClient,
  albumId: string,
  page: number,
  opts: { includeProcessing?: boolean; onlyIds?: string[] } = {},
): Promise<{ items: GridItem[]; hasMore: boolean }> {
  if (opts.onlyIds && opts.onlyIds.length === 0) return { items: [], hasMore: false };
  let query = supabase
    .from("media")
    .select("id, kind, width, height, duration_seconds, status, original_filename, thumb_path, poster_path")
    .eq("album_id", albumId)
    .order("sort_at", { ascending: true })
    .order("id", { ascending: true })
    .range(page * MEDIA_PAGE_SIZE, (page + 1) * MEDIA_PAGE_SIZE);
  if (!opts.includeProcessing) query = query.eq("status", "ready");
  if (opts.onlyIds) query = query.in("id", opts.onlyIds);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const pageRows = rows.slice(0, MEDIA_PAGE_SIZE);
  const urls = await signPaths(
    supabase,
    pageRows.map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );

  return {
    hasMore: rows.length > MEDIA_PAGE_SIZE,
    items: pageRows.map((m) => {
      const path = m.thumb_path ?? m.poster_path;
      return {
        id: m.id,
        kind: m.kind,
        width: m.width,
        height: m.height,
        duration_seconds: m.duration_seconds,
        status: m.status,
        original_filename: m.original_filename,
        thumbUrl: path ? (urls.get(path) ?? null) : null,
      };
    }),
  };
}

export type ViewerData = {
  media: Media;
  displayUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  strip: { id: string; thumbUrl: string | null; kind: string }[];
};

const STRIP_RADIUS = 12;

export async function getViewerData(supabase: UserClient, albumId: string, mediaId: string): Promise<ViewerData | null> {
  const { data: media } = await supabase
    .from("media")
    .select("*")
    .eq("id", mediaId)
    .eq("album_id", albumId)
    .eq("status", "ready")
    .maybeSingle();
  if (!media) return null;

  const at = `"${media.sort_at}"`;
  const before = `sort_at.lt.${at},and(sort_at.eq.${at},id.lt.${media.id})`;
  const after = `sort_at.gt.${at},and(sort_at.eq.${at},id.gt.${media.id})`;
  const stripColumns = "id, kind, thumb_path, poster_path";

  const [prevRows, nextRows, beforeCount, totalCount] = await Promise.all([
    supabase
      .from("media")
      .select(stripColumns)
      .eq("album_id", albumId)
      .eq("status", "ready")
      .or(before)
      .order("sort_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(STRIP_RADIUS),
    supabase
      .from("media")
      .select(stripColumns)
      .eq("album_id", albumId)
      .eq("status", "ready")
      .or(after)
      .order("sort_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(STRIP_RADIUS),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("album_id", albumId)
      .eq("status", "ready")
      .or(before),
    supabase.from("media").select("id", { count: "exact", head: true }).eq("album_id", albumId).eq("status", "ready"),
  ]);

  const prev = (prevRows.data ?? []).reverse();
  const next = nextRows.data ?? [];
  const stripRows = [...prev, media, ...next];

  const isVideo = media.kind === "video";
  const [thumbUrls, displayUrls, videoUrls] = await Promise.all([
    signPaths(
      supabase,
      stripRows.map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
      SIGNED_URL_TTL.thumb,
    ),
    signPaths(
      supabase,
      [isVideo ? media.poster_path : (media.display_path ?? media.storage_path)].filter((p): p is string => Boolean(p)),
      SIGNED_URL_TTL.display,
    ),
    isVideo ? signPaths(supabase, [media.storage_path], SIGNED_URL_TTL.video) : Promise.resolve(new Map<string, string>()),
  ]);

  const displayPath = isVideo ? media.poster_path : (media.display_path ?? media.storage_path);

  return {
    media,
    displayUrl: !isVideo && displayPath ? (displayUrls.get(displayPath) ?? null) : null,
    posterUrl: isVideo && media.poster_path ? (displayUrls.get(media.poster_path) ?? null) : null,
    videoUrl: isVideo ? (videoUrls.get(media.storage_path) ?? null) : null,
    prevId: prev.length ? prev[prev.length - 1].id : null,
    nextId: next.length ? next[0].id : null,
    position: (beforeCount.count ?? 0) + 1,
    total: totalCount.count ?? 0,
    strip: stripRows.map((m) => {
      const path = m.thumb_path ?? m.poster_path;
      return { id: m.id, kind: m.kind, thumbUrl: path ? (thumbUrls.get(path) ?? null) : null };
    }),
  };
}

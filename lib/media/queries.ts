import "server-only";
import { STUCK_AFTER_MS } from "@/lib/media/constants";
import type { Media } from "@/lib/db/types";
import { r2Url } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, mediaClaim, mediaClaims, signedUrlLifetime, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

export const MEDIA_PAGE_SIZE = 60;

export type GridItem = Pick<Media, "id" | "kind" | "width" | "height" | "duration_seconds" | "status" | "original_filename"> & {
  thumbUrl: string | null;
  byteSize: number | null;
};

export async function listAlbumMedia(
  supabase: UserClient,
  albumId: string,
  page: number,
  opts: { includeProcessing?: boolean; onlyIds?: string[] } = {},
): Promise<{ items: GridItem[]; hasMore: boolean }> {
  if (opts.onlyIds && opts.onlyIds.length === 0) return { items: [], hasMore: false };
  let query = supabase
    .from("media")
    .select("id, event_id, album_id, kind, width, height, duration_seconds, status, original_filename, thumb_path, poster_path, updated_at, byte_size")
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
    mediaClaims(pageRows.map((m) => ({ ...m, paths: [m.thumb_path ?? m.poster_path] }))),
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
        // An upload that hasn't moved in an hour has stopped; calling it
        // "Processing" for two weeks told the organiser to wait for nothing.
        status: m.status === "processing" && Date.parse(m.updated_at) < Date.now() - STUCK_AFTER_MS ? "failed" : m.status,
        original_filename: m.original_filename,
        thumbUrl: path ? (urls.get(path) ?? null) : null,
        byteSize: m.byte_size,
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
  /** The photos either side at display size (a video's poster), so a swipe can slide one in before the page for it loads. */
  neighbours: { prev: Slide | null; next: Slide | null };
};

export type Slide = { id: string; kind: string; url: string | null };

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
  const stripColumns = "id, event_id, album_id, kind, thumb_path, poster_path, display_path, storage_path";

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
  const slidePath = (m: { kind: string; poster_path: string | null; display_path: string | null; storage_path: string }) =>
    m.kind === "video" ? m.poster_path : (m.display_path ?? m.storage_path);
  const besides = [prev[prev.length - 1], next[0]].filter((m): m is NonNullable<typeof m> => Boolean(m));
  const [thumbUrls, displayUrls, videoUrls, besideUrls] = await Promise.all([
    signPaths(
      supabase,
      mediaClaims(stripRows.map((m) => ({ ...m, paths: [m.thumb_path ?? m.poster_path] }))),
      SIGNED_URL_TTL.thumb,
    ),
    signPaths(
      supabase,
      [mediaClaim(media, isVideo ? media.poster_path : (media.display_path ?? media.storage_path))].filter((c) => c !== null),
      SIGNED_URL_TTL.display,
    ),
    isVideo
      ? signPaths(supabase, [mediaClaim(media, media.storage_path)].filter((c) => c !== null), SIGNED_URL_TTL.video)
      : Promise.resolve(new Map<string, string>()),
    signPaths(
      supabase,
      mediaClaims(besides.map((m) => ({ ...m, paths: [slidePath(m)] }))),
      SIGNED_URL_TTL.display,
    ),
  ]);
  const slide = (m: (typeof besides)[number] | undefined): Slide | null => {
    if (!m) return null;
    const path = slidePath(m);
    return { id: m.id, kind: m.kind, url: path ? (besideUrls.get(path) ?? null) : null };
  };
  // Video plays from the R2 copy once it has one (docs/handoff-retention-backups.md).
  const r2Video = isVideo ? await r2Url(media, signedUrlLifetime(SIGNED_URL_TTL.video)) : null;

  const displayPath = isVideo ? media.poster_path : (media.display_path ?? media.storage_path);

  return {
    media,
    displayUrl: !isVideo && displayPath ? (displayUrls.get(displayPath) ?? null) : null,
    posterUrl: isVideo && media.poster_path ? (displayUrls.get(media.poster_path) ?? null) : null,
    videoUrl: isVideo ? (r2Video ?? videoUrls.get(media.storage_path) ?? null) : null,
    prevId: prev.length ? prev[prev.length - 1].id : null,
    nextId: next.length ? next[0].id : null,
    position: (beforeCount.count ?? 0) + 1,
    total: totalCount.count ?? 0,
    strip: stripRows.map((m) => {
      const path = m.thumb_path ?? m.poster_path;
      return { id: m.id, kind: m.kind, thumbUrl: path ? (thumbUrls.get(path) ?? null) : null };
    }),
    neighbours: { prev: slide(prev[prev.length - 1]), next: slide(next[0]) },
  };
}

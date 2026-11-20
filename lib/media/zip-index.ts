import "server-only";
import type { UserClient } from "@/lib/supabase/server";
import { zipPartSummaries, type ZipPartSummary, type ZipSized } from "./zip-parts";

const PAGE = 1000;

export type ZipSource = {
  id: string;
  event_id: string;
  album_id: string | null;
  storage_path: string;
  original_filename: string | null;
  backed_up_at: string | null;
  byte_size: number | null;
};

async function eachPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

/** PostgREST's answer when a function isn't deployed yet: the app can ship before its migration. */
function isMissingRpc(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || /could not find the function|schema cache/i.test(error.message ?? "");
}

function sized(row: ZipSource): ZipSource & ZipSized {
  return { ...row, byteSize: row.byte_size };
}

/** Ready files in album order, the same order the zip is built in. */
export async function albumZipItems(supabase: UserClient, albumId: string): Promise<(ZipSource & ZipSized)[]> {
  const rows = await eachPage<ZipSource>((from, to) =>
    supabase
      .from("media")
      .select("id, event_id, album_id, storage_path, original_filename, backed_up_at, byte_size")
      .eq("album_id", albumId)
      .eq("status", "ready")
      .order("sort_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return rows.map(sized);
}

/** File counts per zip part, for the download links. One call (migration 44); paged reads if it isn't there yet. */
export async function albumZipPartCounts(supabase: UserClient, albumId: string): Promise<ZipPartSummary[]> {
  const { data: sizes, error } = await supabase.rpc("album_media_sizes", { p_album_id: albumId });
  if (!error) return zipPartSummaries((sizes ?? []).map((byteSize) => ({ byteSize })));
  if (!isMissingRpc(error)) throw new Error(error.message);
  const rows = await eachPage<{ byte_size: number | null }>((from, to) =>
    supabase
      .from("media")
      .select("byte_size")
      .eq("album_id", albumId)
      .eq("status", "ready")
      .order("sort_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return zipPartSummaries(rows.map((row) => ({ byteSize: row.byte_size })));
}

type YourPhotoRow = {
  media: {
    id: string;
    event_id: string;
    album_id: string | null;
    storage_path: string;
    original_filename: string | null;
    status: string;
    content_hash: string | null;
    backed_up_at: string | null;
    byte_size: number | null;
    albums: { allow_download: boolean } | null;
  };
};

/**
 * The caller's confirmed photos, downloads-off albums left out unless they
 * run the event, duplicates collapsed. Same rules as the your-photos zip.
 */
export async function yourPhotosZipItems(
  supabase: UserClient,
  eventId: string,
  manageAlbums: boolean,
): Promise<(ZipSource & ZipSized)[]> {
  const rows = await eachPage<YourPhotoRow>((from, to) =>
    supabase
      .from("face_matches")
      .select(
        "media_id, media!inner(id, event_id, album_id, storage_path, original_filename, status, content_hash, backed_up_at, byte_size, albums!media_album_id_fkey(allow_download))",
      )
      .eq("event_id", eventId)
      .eq("state", "confirmed")
      .order("media_id")
      .range(from, to),
  );
  const seen = new Set<string>();
  const items: (ZipSource & ZipSized)[] = [];
  for (const row of rows) {
    const media = row.media;
    if (media.status !== "ready") continue;
    if (!manageAlbums && media.albums?.allow_download === false) continue;
    const key = media.content_hash ?? media.id;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(sized(media));
  }
  return items;
}

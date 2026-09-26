import "server-only";
import type { Json, MemberFaceProfile } from "@/lib/db/types";
import { facesConfigured } from "@/lib/faces/client";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

export const PHOTOS_OF_YOU_PAGE_SIZE = 60;
const SUGGESTION_LIMIT = 24;

export type BoundingBox = { Left: number; Top: number; Width: number; Height: number };

export function asBox(value: Json | null): BoundingBox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const box = value as Record<string, unknown>;
  const numbers = ["Left", "Top", "Width", "Height"].map((key) => box[key]);
  if (!numbers.every((n) => typeof n === "number")) return null;
  const [Left, Top, Width, Height] = numbers as number[];
  return { Left, Top, Width, Height };
}

type DupeFields = { id: string; content_hash: string | null; original_filename: string | null; byte_size: number | null };

/**
 * Which rows are the same photo. Uploads carry a content hash now; rows from
 * before that fall back to filename plus exact byte size, which is what a
 * re-uploaded camera file keeps. Without either, a row is only itself.
 */
function dupeKey(media: DupeFields): string {
  if (media.content_hash) return `h:${media.content_hash}`;
  if (media.original_filename && media.byte_size) return `f:${media.original_filename}:${media.byte_size}`;
  return `id:${media.id}`;
}

export type FaceState = {
  enabled: boolean;
  profile: Pick<MemberFaceProfile, "id" | "status" | "failure_reason" | "consented_at"> | null;
  backfillRunning: boolean;
};

/**
 * Where this member stands: has the club turned it on, have they enrolled,
 * and is the library still being worked through. Three separate answers
 * because the three empty states they drive are not the same.
 */
export async function faceStateFor(supabase: UserClient, clubId: string, userId: string): Promise<FaceState> {
  const [{ data: settings }, { data: profile }] = await Promise.all([
    supabase.from("club_face_settings").select("enabled, backfill_status").eq("club_id", clubId).maybeSingle(),
    supabase
      .from("member_face_profiles")
      .select("id, status, failure_reason, consented_at")
      .eq("club_id", clubId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return {
    // A club row can say "on" while this deployment has no AWS credentials —
    // the database is shared between local and production, and production may
    // not have the keys yet. Without them nothing can index, match or delete,
    // so the honest answer to a member is that the feature is not here. The
    // alternative is an enrolment that accepts a selfie and never finishes.
    enabled: Boolean(settings?.enabled) && facesConfigured(),
    profile: profile ?? null,
    backfillRunning: settings?.backfill_status === "queued" || settings?.backfill_status === "running",
  };
}

export type PhotoOfYou = {
  matchId: string;
  mediaId: string;
  albumId: string | null;
  albumTitle: string;
  thumbUrl: string | null;
  similarity: number;
};

export type PhotosOfYouGroup = {
  albumId: string;
  albumTitle: string;
  albumDate: string | null;
  items: PhotoOfYou[];
};

/**
 * The grid, grouped by album.
 *
 * A member's own photos are the one view in this app where the flat, purely
 * chronological order was wrong: a run of 40 thumbnails from four different
 * nights reads as a pile, not as "the ball, then the grand final". Albums are
 * how people remember events, so they are how these are stacked — the same
 * shape the Saved page uses.
 *
 * RLS already restricts face_matches to the caller's own profile, so there is
 * deliberately no user filter here. Do not "fix" that by adding one: it would
 * only hide the fact that the guarantee lives in the database.
 */
export async function listPhotosOfYou(
  supabase: UserClient,
  clubId: string,
  page = 0,
): Promise<{ groups: PhotosOfYouGroup[]; total: number; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("face_matches")
    // albums has to be named by its FK: media.album_id points at albums, and
    // albums.cover_media_id points back at media, so a bare `albums` embed is
    // ambiguous and PostgREST refuses it.
    .select(
      "id, media_id, similarity, media!inner(id, album_id, sort_at, thumb_path, poster_path, content_hash, original_filename, byte_size, albums!media_album_id_fkey(title, event_date))",
    )
    .eq("club_id", clubId)
    .eq("state", "confirmed")
    .order("sort_at", { ascending: false, referencedTable: "media" })
    .range(page * PHOTOS_OF_YOU_PAGE_SIZE, (page + 1) * PHOTOS_OF_YOU_PAGE_SIZE);
  if (error) throw error;

  const rows = data ?? [];
  // The same photo uploaded twice is two media rows and so two matches, which
  // showed "6 photos of you" for 3 photos. Show each picture once.
  const seen = new Set<string>();
  const pageRows = rows.slice(0, PHOTOS_OF_YOU_PAGE_SIZE).filter((row) => {
    const key = dupeKey(row.media);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // One signing call for the page, the way lib/media/queries.ts does it. One
  // request per tile is the thing this codebase has consistently avoided.
  const urls = await signPaths(
    supabase,
    pageRows.map((row) => row.media.thumb_path ?? row.media.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );

  // Album order follows the photo order, so the most recent event is first
  // and the group's own photos stay newest-first inside it.
  const groups = new Map<string, PhotosOfYouGroup>();
  for (const row of pageRows) {
    const albumId = row.media.album_id;
    if (!albumId) continue; // loose media has no event to sit under
    const path = row.media.thumb_path ?? row.media.poster_path;
    const group = groups.get(albumId) ?? {
      albumId,
      albumTitle: row.media.albums?.title ?? "This club",
      albumDate: row.media.albums?.event_date ?? null,
      items: [],
    };
    group.items.push({
      matchId: row.id,
      mediaId: row.media_id,
      albumId,
      albumTitle: group.albumTitle,
      thumbUrl: path ? (urls.get(path) ?? null) : null,
      similarity: Number(row.similarity),
    });
    groups.set(albumId, group);
  }

  return {
    groups: [...groups.values()],
    total: pageRows.length,
    hasMore: rows.length > PHOTOS_OF_YOU_PAGE_SIZE,
  };
}

export type Suggestion = {
  matchId: string;
  /** Every match for this same picture, the first included. A photo uploaded
      twice is asked about once, and the answer applies to both copies. */
  matchIds: string[];
  mediaId: string;
  albumId: string | null;
  albumTitle: string;
};

/**
 * "Is this you?". The card shows /api/faces/[matchId]/crop, a 240px crop cut
 * from the display copy on the server, so nothing here needs signing.
 */
export async function listFaceSuggestions(
  supabase: UserClient,
  clubId: string,
): Promise<{ items: Suggestion[]; total: number }> {
  const { data, error } = await supabase
    .from("face_matches")
    .select(
      "id, media_id, similarity, media!inner(id, album_id, content_hash, original_filename, byte_size, albums!media_album_id_fkey(title))",
    )
    .eq("club_id", clubId)
    .eq("state", "suggested")
    .order("similarity", { ascending: false })
    .limit(SUGGESTION_LIMIT);
  if (error) throw error;

  // The strip shows the most likely handful; the count tells the truth about
  // the rest, so answering them visibly shortens the queue.
  const { count: total } = await supabase
    .from("face_matches")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("state", "suggested");

  const byKey = new Map<string, Suggestion>();
  for (const row of data ?? []) {
    const key = dupeKey(row.media);
    const existing = byKey.get(key);
    if (existing) {
      existing.matchIds.push(row.id);
      continue;
    }
    byKey.set(key, {
      matchId: row.id,
      matchIds: [row.id],
      mediaId: row.media_id,
      albumId: row.media.album_id,
      albumTitle: row.media.albums?.title ?? "This club",
    });
  }
  const items = [...byKey.values()];
  const duplicates = (data?.length ?? 0) - items.length;

  return { total: Math.max(items.length, (total ?? 0) - duplicates), items };
}

/**
 * "12 photos of you" on an album card. One grouped count for every album on
 * screen, in the same batched style as the cover lookups in album-list.ts —
 * never one query per card.
 */
export async function countPhotosOfYouByAlbum(
  supabase: UserClient,
  clubId: string,
  albumIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (albumIds.length === 0) return counts;
  const { data } = await supabase
    .from("face_matches")
    .select("media_id, media!inner(id, album_id, content_hash, original_filename, byte_size)")
    .eq("club_id", clubId)
    .eq("state", "confirmed")
    .in("media.album_id", albumIds);
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const albumId = row.media?.album_id;
    if (!albumId) continue;
    const key = `${albumId}|${dupeKey(row.media)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.set(albumId, (counts.get(albumId) ?? 0) + 1);
  }
  return counts;
}

/**
 * The photos in one album you are confirmed in, one per picture. Drives the
 * "You" filter on the album page, which is where members usually start.
 */
export async function photosOfYouInAlbum(supabase: UserClient, albumId: string): Promise<string[]> {
  const { data } = await supabase
    .from("face_matches")
    .select("media_id, media!inner(id, album_id, content_hash, original_filename, byte_size)")
    .eq("state", "confirmed")
    .eq("media.album_id", albumId)
    .limit(500);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of data ?? []) {
    const key = dupeKey(row.media);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(row.media_id);
  }
  return ids;
}

/**
 * Is this specific photo one of yours? Drives "Not me" in the viewer.
 *
 * `limit(1)` rather than `maybeSingle()`: a unique constraint now guarantees
 * one row per member per photo, but maybeSingle() answers "nothing here" when
 * it finds more than one, which would have hidden the button in exactly the
 * case somebody wanted it. A row that is wrong is worth being able to reject.
 */
export async function matchForMedia(
  supabase: UserClient,
  mediaId: string,
): Promise<{ matchId: string; state: string } | null> {
  const { data } = await supabase
    .from("face_matches")
    .select("id, state")
    .eq("media_id", mediaId)
    .in("state", ["confirmed", "suggested"])
    .order("similarity", { ascending: false })
    .limit(1);
  const row = data?.[0];
  return row ? { matchId: row.id, state: row.state } : null;
}

/** Distinct pictures, not match rows, so the badge agrees with the page. */
export async function countPhotosOfYou(supabase: UserClient, clubId: string): Promise<number> {
  const { data, count } = await supabase
    .from("face_matches")
    .select("media!inner(id, content_hash, original_filename, byte_size)", { count: "exact" })
    .eq("club_id", clubId)
    .eq("state", "confirmed")
    .limit(1000);
  const rows = data ?? [];
  // Past a thousand the exact count is the better number to show; the
  // duplicates it would include are a rounding error at that size.
  if ((count ?? 0) > rows.length) return count ?? rows.length;
  return new Set(rows.map((row) => dupeKey(row.media))).size;
}

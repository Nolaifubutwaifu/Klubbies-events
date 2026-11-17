import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { serverEnv } from "@/lib/env";
import { queueBackupPurge } from "@/lib/backup/r2";
import { createAdminClient } from "@/lib/supabase/admin";

// Narrow storage interface (masterfile §8.1). Swapping Supabase Storage for S3
// or R2 should only touch this module.

import { MEDIA_OBJECT_NAMES, claimAllowed, ownedMediaObjectPath, type PathClaim } from "./object-paths";
import { BUCKET, logoMarkPath } from "./paths";

export type { PathClaim } from "./object-paths";
export { claimAllowed, mediaClaim, mediaClaims, ownedAvatarPath, ownedMediaObjectPath } from "./object-paths";

export { BUCKET, logoMarkPath } from "./paths";

export const SIGNED_URL_TTL = {
  thumb: 10 * 60,
  display: 10 * 60,
  video: 60 * 60,
  download: 5 * 60,
} as const;

type Client = SupabaseClient<Database>;

/** A signed URL's lifetime, shortened in tests by SIGNED_URL_TTL_OVERRIDE_SECONDS. */
export function signedUrlLifetime(seconds: number): number {
  return ttl(seconds);
}

function ttl(seconds: number): number {
  return serverEnv().SIGNED_URL_TTL_OVERRIDE_SECONDS ?? seconds;
}

export function mediaFolder(eventId: string, albumId: string, mediaId: string): string {
  return `events/${eventId}/albums/${albumId}/${mediaId}`;
}

export function derivativePaths(folder: string) {
  return { thumb: `${folder}/thumb.webp`, display: `${folder}/display.webp`, poster: `${folder}/poster.jpg` };
}

export function logoPath(eventId: string, ext: string): string {
  return `events/${eventId}/logo/logo.${ext}`;
}

/** Size of the small logo rendition: 96px, for 32 to 48px badges at 2x. */
export const LOGO_MARK_SIZE = 96;


// Signed URLs already issued, reused while they still have most of their life.
//
// Every page load used to sign afresh, and a fresh signature is a fresh URL,
// so the browser could never reuse an image it had downloaded a second ago:
// the album grid, the viewer's filmstrip and Saved all went blank for
// seconds on every visit. Reusing the URL makes the browser cache work, and
// the lifetime is untouched — a reused URL expires exactly when it would have
// (masterfile §8: ten minutes for thumbnails).
//
// Entries are keyed by a hash of the caller's access token, never by user id
// alone. The service role mints the URL (see signPaths); the cache still
// only hands it back to the session that asked, so one viewer's URL is not
// reused for someone else's request. The service role has no session, so a
// cron or script that signs is never cached.
const signedCache = new Map<string, { url: string; expiresAt: number }>();
const MAX_CACHED = 20_000;
/** Reuse only while at least this much of the lifetime remains, so a page
    rendered from the cache still has minutes to load its images. */
const REUSE_WHILE_REMAINING = 0.4;

async function cacheScope(client: Client): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    return token ? createHash("sha256").update(token).digest("base64url").slice(0, 22) : null;
  } catch {
    return null;
  }
}

function pruneCache(now: number) {
  if (signedCache.size < MAX_CACHED) return;
  for (const [key, entry] of signedCache) if (entry.expiresAt <= now) signedCache.delete(key);
  // Still full of live entries: drop the oldest half. Map keeps insertion order.
  let excess = signedCache.size - MAX_CACHED / 2;
  for (const key of signedCache.keys()) {
    if (excess-- <= 0) break;
    signedCache.delete(key);
  }
}

/**
 * Signs many paths in one call.
 *
 * The signatures are minted with the service role, not the caller's client.
 * Storage's SELECT policy re-reads `media` (via storage.search / the object
 * name) for every file, and that check timed out with 544 when one person
 * uploaded a handful of photos — and it would do the same when a full album
 * grid asks for sixty thumbnails at once. Callers only pass paths taken from
 * rows their own client already selected under RLS (a media row, a logo, an
 * avatar). This function does not decide who may see a file, and it never
 * signs a path supplied by the browser. A path the caller could not read
 * never reaches here, so album visibility is unchanged.
 *
 * `client` scopes the in-memory cache to that session. It is not the signer.
 */
export async function signPaths(client: Client, claims: PathClaim[], seconds: number): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      claims
        .filter((claim) => {
          if (!claim.path) return false;
          if (claimAllowed(claim)) return true;
          console.error("refusing to sign a path outside its owner", claim.kind, claim.path);
          return false;
        })
        .map((claim) => claim.path),
    ),
  ];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const lifetime = ttl(seconds);
  const now = Date.now();
  const scope = await cacheScope(client);
  const keyFor = (path: string) => `${scope}|${lifetime}|${path}`;

  const missing: string[] = [];
  for (const path of unique) {
    const hit = scope ? signedCache.get(keyFor(path)) : undefined;
    if (hit && hit.expiresAt - now > lifetime * 1000 * REUSE_WHILE_REMAINING) result.set(path, hit.url);
    else missing.push(path);
  }

  const admin = createAdminClient();
  for (let i = 0; i < missing.length; i += 500) {
    const chunk = missing.slice(i, i + 500);
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(chunk, lifetime);
    if (error) throw error;
    for (const item of data ?? []) {
      if (!item.path || !item.signedUrl || item.error) continue;
      result.set(item.path, item.signedUrl);
      if (scope) signedCache.set(keyFor(item.path), { url: item.signedUrl, expiresAt: now + lifetime * 1000 });
    }
  }
  if (scope && missing.length) pruneCache(now);
  return result;
}

/**
 * Signed URLs for event logos as badges, keyed by the logo path: the small
 * mark where one exists, else the original. Logos uploaded before marks
 * existed have none until they're replaced or backfilled, and the fallback
 * keeps them showing.
 */
export async function signLogoMarks(client: Client, logoPaths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const logos = [...new Set(logoPaths.filter((p): p is string => Boolean(p)))];
  const claims: PathClaim[] = [];
  for (const logo of logos) {
    const eventId = logo.match(/^events\/([0-9a-f-]{36})\/logo\//i)?.[1];
    if (!eventId) {
      console.error("refusing to sign a logo outside events/{id}/logo", logo);
      continue;
    }
    claims.push({ kind: "event", path: logo, eventId }, { kind: "event", path: logoMarkPath(logo), eventId });
  }
  const signed = await signPaths(client, claims, SIGNED_URL_TTL.display);
  const result = new Map<string, string>();
  for (const logo of logos) {
    const url = signed.get(logoMarkPath(logo)) ?? signed.get(logo);
    if (url) result.set(logo, url);
  }
  return result;
}

export async function signDownload(
  client: Client,
  claim: Extract<PathClaim, { kind: "media" }>,
  filename: string,
): Promise<string | null> {
  void client;
  if (!ownedMediaObjectPath(claim.eventId, claim.albumId, claim.mediaId, claim.path)) {
    console.error("refusing to sign a download outside its photo", claim.path);
    return null;
  }
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(claim.path, ttl(SIGNED_URL_TTL.download), { download: filename });
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * One signed upload URL per exact object path, minted with the service role.
 * The caller has already checked the person may write this album and created
 * the media row. The browser then PUTs the thumbnail straight to that path,
 * so storage INSERT/UPDATE policies (and their per-file database lookups)
 * are not evaluated for every derivative.
 */
export async function signedUploadTokens(
  owner: { eventId: string; albumId: string; mediaId: string },
  paths: string[],
): Promise<Record<string, { signedUrl: string; path: string; token: string }>> {
  const admin = createAdminClient();
  const signed: Record<string, { signedUrl: string; path: string; token: string }> = {};
  for (const path of paths) {
    if (!ownedMediaObjectPath(owner.eventId, owner.albumId, owner.mediaId, path)) {
      console.error("refusing to sign an upload outside its photo", path);
      throw new Error("refusing to sign an upload outside its photo");
    }
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) throw error ?? new Error(`could not sign ${path}`);
    signed[path] = { signedUrl: data.signedUrl, path: data.path, token: data.token };
  }
  return signed;
}

/**
 * Which of the named files exist in a folder, and their sizes. Each is looked
 * up by its exact path. Listing the folder instead asked storage to search the
 * whole bucket by prefix, and in production that averaged over two seconds
 * for every upload being finished.
 *
 * The service role does the lookup. Both callers have already authorised the
 * media row (the uploader, an organiser, or the guest link that created it)
 * and pass only that row's folder. info() under the user JWT re-ran storage
 * RLS per file and was part of the 544 timeouts.
 */
export async function folderObjects(
  owner: { eventId: string; albumId: string; mediaId: string },
  names: string[],
): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  const folder = mediaFolder(owner.eventId, owner.albumId, owner.mediaId);
  const known = names.filter((name) => (MEDIA_OBJECT_NAMES as readonly string[]).includes(name) && !name.includes("/"));
  if (known.length !== names.length) console.error("refusing to list a name outside this photo", owner.mediaId);
  const admin = createAdminClient();
  await Promise.all(
    known.map(async (name) => {
      const path = `${folder}/${name}`;
      if (!ownedMediaObjectPath(owner.eventId, owner.albumId, owner.mediaId, path)) return;
      const { data, error } = await admin.storage.from(BUCKET).info(path);
      if (error) {
        // A file that was never uploaded (no poster for a photo) is expected.
        const status = (error as { status?: number; statusCode?: string | number }).status ?? Number((error as { statusCode?: string | number }).statusCode);
        if (status === 400 || status === 404 || /not.?found/i.test(error.message)) return;
        throw error;
      }
      sizes.set(name, typeof data?.size === "number" ? data.size : 0);
    }),
  );
  return sizes;
}

/**
 * Removes objects with the service role. Authorise before calling. Every
 * permanent file delete comes through here, so this is also where the R2
 * copies are queued to go 30 days later.
 */
export async function removeObjects(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  const admin = createAdminClient();
  for (let i = 0; i < unique.length; i += 1000) {
    const { error } = await admin.storage.from(BUCKET).remove(unique.slice(i, i + 1000));
    if (error) throw error;
  }
  await queueBackupPurge(unique);
}

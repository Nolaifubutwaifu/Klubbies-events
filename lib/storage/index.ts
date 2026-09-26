import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Narrow storage interface (masterfile §8.1). Swapping Supabase Storage for S3
// or R2 should only touch this module.

export const BUCKET = "club_media";

export const SIGNED_URL_TTL = {
  thumb: 10 * 60,
  display: 10 * 60,
  video: 60 * 60,
  download: 5 * 60,
} as const;

type Client = SupabaseClient<Database>;

function ttl(seconds: number): number {
  return serverEnv().SIGNED_URL_TTL_OVERRIDE_SECONDS ?? seconds;
}

export function mediaFolder(clubId: string, albumId: string, mediaId: string): string {
  return `clubs/${clubId}/albums/${albumId}/${mediaId}`;
}

export function derivativePaths(folder: string) {
  return { thumb: `${folder}/thumb.webp`, display: `${folder}/display.webp`, poster: `${folder}/poster.jpg` };
}

export function logoPath(clubId: string, ext: string): string {
  return `clubs/${clubId}/logo/logo.${ext}`;
}

/** Size of the small logo rendition: 96px, for 32 to 48px badges at 2x. */
export const LOGO_MARK_SIZE = 96;

/**
 * The small rendition that sits beside a logo: logo-1727.png → mark-1727.webp.
 * Every badge in the app is 24 to 48px, and they were loading the original
 * upload — one club's was 3936px wide — on every page.
 */
export function logoMarkPath(logoPath: string): string {
  const slash = logoPath.lastIndexOf("/");
  const base = logoPath.slice(slash + 1).replace(/\.[^.]+$/, "").replace(/^logo/, "mark");
  return `${logoPath.slice(0, slash)}/${base}.webp`;
}

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
// alone: the signing call is the authorisation check (the storage policy
// mirrors media visibility), and only the same session that passed it gets
// the URL back. The service role has no session, so it is never cached.
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
 * Signs many paths in one call. Always pass the user's client: the storage
 * select policy mirrors media visibility, so a path the user may not see
 * simply comes back unsigned.
 */
export async function signPaths(client: Client, paths: string[], seconds: number): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
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

  for (let i = 0; i < missing.length; i += 500) {
    const chunk = missing.slice(i, i + 500);
    const { data, error } = await client.storage.from(BUCKET).createSignedUrls(chunk, lifetime);
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
 * Signed URLs for club logos as badges, keyed by the logo path: the small
 * mark where one exists, else the original. Logos uploaded before marks
 * existed have none until they're replaced or backfilled, and the fallback
 * keeps them showing.
 */
export async function signLogoMarks(client: Client, logoPaths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const logos = [...new Set(logoPaths.filter((p): p is string => Boolean(p)))];
  const signed = await signPaths(client, [...logos, ...logos.map(logoMarkPath)], SIGNED_URL_TTL.display);
  const result = new Map<string, string>();
  for (const logo of logos) {
    const url = signed.get(logoMarkPath(logo)) ?? signed.get(logo);
    if (url) result.set(logo, url);
  }
  return result;
}

export async function signDownload(client: Client, path: string, filename: string): Promise<string | null> {
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, ttl(SIGNED_URL_TTL.download), { download: filename });
  if (error || !data) return null;
  return data.signedUrl;
}

export async function listFolder(client: Client, folder: string): Promise<Map<string, number>> {
  const { data, error } = await client.storage.from(BUCKET).list(folder, { limit: 20 });
  if (error) throw error;
  const sizes = new Map<string, number>();
  for (const obj of data ?? []) {
    const size = typeof obj.metadata?.size === "number" ? obj.metadata.size : 0;
    sizes.set(obj.name, size);
  }
  return sizes;
}

/** Removes objects with the service role. Authorise before calling. */
export async function removeObjects(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  const admin = createAdminClient();
  for (let i = 0; i < unique.length; i += 1000) {
    const { error } = await admin.storage.from(BUCKET).remove(unique.slice(i, i + 1000));
    if (error) throw error;
  }
}

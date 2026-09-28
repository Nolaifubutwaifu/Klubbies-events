import "server-only";
import { after } from "next/server";
import type { S3Client } from "@aws-sdk/client-s3";
import { BUCKET, logoMarkPath } from "@/lib/storage/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteFromR2,
  isBackedUpPath,
  listR2Folders,
  listR2Keys,
  presignR2,
  r2Client,
  r2ConfigFrom,
  readFromR2,
  streamUrlToR2,
  type R2Config,
} from "./r2-core";

/**
 * The app's side of the R2 copy (docs/handoff-retention-backups.md, phase 2):
 * copying each upload across, serving full quality files from it, deleting
 * copies 30 days after the original goes, and the monthly safety net.
 *
 * With R2 unconfigured every function here quietly does nothing, and every
 * caller falls back to Supabase.
 */

let cached: { config: R2Config; client: S3Client } | null | undefined;

function r2(): { config: R2Config; client: S3Client } | null {
  if (cached === undefined) {
    const config = r2ConfigFrom(process.env);
    cached = config ? { config, client: r2Client(config) } : null;
  }
  return cached;
}

export function r2Configured(): boolean {
  return r2() !== null;
}

/** Copies stop being attempted by the web app after this many failures. */
const MAX_ATTEMPTS = 5;
/** Bigger files are left to the hourly pass rather than the upload request. */
const KICK_MAX_BYTES = 200 * 1024 * 1024;
/** A cautious guess at Supabase to R2 speed, for deciding what fits a budget. */
const BYTES_PER_SECOND = 10 * 1024 * 1024;

type MediaFiles = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  display_path: string | null;
  poster_path: string | null;
  byte_size: number | null;
  backup_attempts: number;
};

const MEDIA_FILE_COLUMNS = "id, storage_path, thumb_path, display_path, poster_path, byte_size, backup_attempts";

function filesOf(m: Pick<MediaFiles, "storage_path" | "thumb_path" | "display_path" | "poster_path">): string[] {
  return [m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p));
}

async function copyPath(path: string): Promise<void> {
  const target = r2();
  if (!target) return;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 15 * 60);
  if (error || !data) throw new Error(`could not sign ${path}: ${error?.message ?? "no url"}`);
  await streamUrlToR2(target.client, target.config, data.signedUrl, path);
}

/** Copies one item's original and previews. Records success or the failure. */
export async function backupMedia(item: MediaFiles): Promise<boolean> {
  if (!r2Configured()) return false;
  const admin = createAdminClient();
  try {
    for (const path of filesOf(item)) await copyPath(path);
    await admin.from("media").update({ backed_up_at: new Date().toISOString(), backup_error: null }).eq("id", item.id);
    return true;
  } catch (error) {
    const attempts = item.backup_attempts + 1;
    const big = (item.byte_size ?? 0) > KICK_MAX_BYTES;
    await admin
      .from("media")
      .update({
        backup_attempts: attempts,
        backup_error: String(error instanceof Error ? error.message : error).slice(0, 500),
        // A big file that keeps failing inside a web request is handed to
        // `pnpm backup-drain`, which has no time limit.
        backup_deferred_at: big && attempts >= 2 ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
    console.error("backup failed", item.id, error);
    return false;
  }
}

/**
 * After an upload finishes: copy it once the response has gone, the way face
 * search is kicked. Big files wait for the hourly pass. Never throws.
 */
export function kickBackup(mediaId: string): void {
  if (!r2Configured()) return;
  const run = async () => {
    const { data } = await createAdminClient().from("media").select(MEDIA_FILE_COLUMNS).eq("id", mediaId).maybeSingle();
    if (!data || (data.byte_size ?? 0) > KICK_MAX_BYTES) return;
    await backupMedia(data);
  };
  const safe = () => run().catch((error) => console.error("backup kick failed", mediaId, error));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

export type BackupDrainResult = { copied: number; failed: number; deferred: number; logos: number };

/**
 * The hourly pass: copies whatever isn't in R2 yet, oldest first, starting
 * nothing that wouldn't fit in `budgetMs` at a cautious speed. A file that
 * could never fit is deferred to `pnpm backup-drain`.
 */
export async function runBackupDrain(budgetMs: number): Promise<BackupDrainResult> {
  const result: BackupDrainResult = { copied: 0, failed: 0, deferred: 0, logos: 0 };
  if (!r2Configured() || budgetMs <= 0) return result;
  const admin = createAdminClient();
  const deadline = Date.now() + budgetMs;

  const { data: pending } = await admin
    .from("media")
    .select(MEDIA_FILE_COLUMNS)
    .is("backed_up_at", null)
    .is("backup_deferred_at", null)
    .eq("status", "ready")
    .lt("backup_attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(200);

  for (const item of pending ?? []) {
    const needMs = (((item.byte_size ?? 0) * 1.1) / BYTES_PER_SECOND) * 1000 + 2_000;
    if (needMs > budgetMs) {
      await admin.from("media").update({ backup_deferred_at: new Date().toISOString() }).eq("id", item.id);
      result.deferred += 1;
      continue;
    }
    if (Date.now() + needMs > deadline) break;
    if (await backupMedia(item)) result.copied += 1;
    else result.failed += 1;
  }

  // Logos (and their small marks), whenever the logo has changed since the last copy.
  if (Date.now() < deadline) {
    const { data: events } = await admin.from("events").select("id, logo_path, logo_backed_up_path").not("logo_path", "is", null).limit(500);
    for (const event of events ?? []) {
      if (Date.now() > deadline) break;
      if (!event.logo_path || event.logo_path === event.logo_backed_up_path) continue;
      try {
        await copyPath(event.logo_path);
        const mark = logoMarkPath(event.logo_path);
        await copyPath(mark).catch(() => undefined); // older logos have no mark
        await admin.from("events").update({ logo_backed_up_path: event.logo_path }).eq("id", event.id);
        result.logos += 1;
      } catch (error) {
        console.error("logo backup failed", event.id, error);
      }
    }
  }
  return result;
}

/**
 * A file left Supabase for good: its copy in R2 goes 30 days later (the
 * database default), so a mistake found within the month can still be undone.
 */
export async function queueBackupPurge(paths: string[]): Promise<void> {
  if (!r2Configured()) return;
  const keys = [...new Set(paths.filter(isBackedUpPath))];
  if (keys.length === 0) return;
  const admin = createAdminClient();
  for (let i = 0; i < keys.length; i += 500) {
    const { error } = await admin
      .from("backup_purge_queue")
      .upsert(keys.slice(i, i + 500).map((key) => ({ key })), { onConflict: "key", ignoreDuplicates: true });
    if (error) console.error("could not queue backup purge", error);
  }
}

/** The hourly pass: deletes copies whose 30 days are up. */
export async function runBackupPurge(now = new Date()): Promise<number> {
  const target = r2();
  const admin = createAdminClient();
  const { data: due } = await admin.from("backup_purge_queue").select("key").lte("due_at", now.toISOString()).limit(2000);
  const keys = (due ?? []).map((row) => row.key);
  if (keys.length === 0) return 0;
  if (target) await deleteFromR2(target.client, target.config, keys);
  for (let i = 0; i < keys.length; i += 500) {
    await admin.from("backup_purge_queue").delete().in("key", keys.slice(i, i + 500));
  }
  return keys.length;
}

/**
 * The monthly safety net: any event folder in R2 whose event no longer
 * exists, and has nothing still waiting in the purge queue, is deleted. A
 * fixed age rule on the bucket would wrongly delete events that paid to keep
 * another year, so this reads the database instead. (The 12 month expiry adds
 * "past its deletion date plus 30 days" to this check.)
 */
export async function runMonthlyBackupCheck(): Promise<{ checked: number; deleted: number }> {
  const target = r2();
  if (!target) return { checked: 0, deleted: 0 };
  const admin = createAdminClient();
  const folders = await listR2Folders(target.client, target.config, "events/");
  const ids = folders.map((f) => f.slice("events/".length, -1)).filter((id) => /^[0-9a-f-]{36}$/.test(id));
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: missing, error } = await admin.rpc("missing_events", { p_ids: ids.slice(i, i + 200) });
    if (error) throw error;
    for (const eventId of (missing as string[] | null) ?? []) {
      const { count } = await admin
        .from("backup_purge_queue")
        .select("key", { count: "exact", head: true })
        .like("key", `events/${eventId}/%`);
      if (count) continue; // still inside its 30 days
      const keys = await listR2Keys(target.client, target.config, `events/${eventId}/`);
      await deleteFromR2(target.client, target.config, keys);
      deleted += keys.length;
    }
  }
  return { checked: ids.length, deleted };
}

/** True once a month: the first hourly run on the 1st, Brisbane time. */
export function isMonthlyCheckHour(now = new Date()): boolean {
  const brisbane = new Date(now.getTime() + 10 * 60 * 60 * 1000); // Brisbane has no daylight saving
  return brisbane.getUTCDate() === 1 && brisbane.getUTCHours() === 3;
}

/**
 * A short-lived link to a full quality file in R2, or null when R2 is off or
 * the file hasn't been copied yet (the caller then uses Supabase). The caller
 * must already have checked the person may see this file.
 */
export async function r2Url(
  item: { storage_path: string; backed_up_at: string | null },
  seconds: number,
  downloadAs?: string,
): Promise<string | null> {
  const target = r2();
  if (!target || !item.backed_up_at) return null;
  try {
    return await presignR2(target.client, target.config, item.storage_path, seconds, downloadAs);
  } catch (error) {
    console.error("could not presign R2 url", item.storage_path, error);
    return null;
  }
}

/** A file's body straight from R2, for zips. Null means use Supabase. */
export async function r2Stream(item: { storage_path: string; backed_up_at: string | null }): Promise<ReadableStream<Uint8Array> | null> {
  const target = r2();
  if (!target || !item.backed_up_at) return null;
  try {
    return await readFromR2(target.client, target.config, item.storage_path);
  } catch (error) {
    console.error("could not read from R2", item.storage_path, error);
    return null;
  }
}

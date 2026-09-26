/**
 * Finds photos uploaded twice into the same album and removes the extra
 * copies, then records a content hash on every row it read so the upload
 * check (supabase/migrations/20260925000020) covers the back catalogue too.
 *
 *   pnpm tsx --env-file=.env.local scripts/dedupe-media.ts --club bobby_pics
 *   pnpm tsx --env-file=.env.local scripts/dedupe-media.ts --club bobby_pics --confirm
 *
 * Without --confirm it only reports. With it, for each set of identical files
 * the oldest row is kept and the others are deleted with their stored
 * objects. Favourites on a deleted copy move to the one kept, and an album
 * cover pointing at a copy is repointed. Face matches on the copies cascade
 * away and their faceprints are queued for deletion, which the next face drain
 * (cron or "Run now") carries out.
 *
 * Needs the migration applied first: it writes media.content_hash.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/db/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

const BUCKET = "club_media";
// Mirrors lib/media/content-hash.ts, so a hash written here matches the one a
// browser computes for the same file.
const FULL_HASH_LIMIT = 96 * 1024 * 1024;
const SAMPLE_BYTES = 8 * 1024 * 1024;

const args = process.argv.slice(2);
const handle = args[args.indexOf("--club") + 1];
const confirm = args.includes("--confirm");
if (!args.includes("--club") || !handle) throw new Error("Pass --club <handle>");

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

function hashBytes(bytes: Buffer): string {
  if (bytes.length <= FULL_HASH_LIMIT) return createHash("sha256").update(bytes).digest("hex");
  const sample = Buffer.concat([
    Buffer.from(`${bytes.length}:`),
    bytes.subarray(0, SAMPLE_BYTES),
    bytes.subarray(bytes.length - SAMPLE_BYTES),
  ]);
  return `s:${createHash("sha256").update(sample).digest("hex")}`;
}

async function main() {
  const { data: club } = await db.from("clubs").select("id, name").eq("handle", handle).maybeSingle();
  if (!club) throw new Error(`No club with handle ${handle}`);

  type Row = {
    id: string;
    album_id: string | null;
    storage_path: string;
    thumb_path: string | null;
    display_path: string | null;
    poster_path: string | null;
    content_hash: string | null;
    original_filename: string | null;
    created_at: string;
  };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("media")
      .select("id, album_id, storage_path, thumb_path, display_path, poster_path, content_hash, original_filename, created_at")
      .eq("club_id", club.id)
      .eq("status", "ready")
      .not("album_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`${club.name}: ${rows.length} ready files in albums`);

  // Hash what isn't hashed yet. Originals, not derivatives: two uploads of the
  // same camera file have identical originals.
  const hashes = new Map<string, string>();
  let read = 0;
  for (const row of rows) {
    if (row.content_hash) {
      hashes.set(row.id, row.content_hash);
      continue;
    }
    const { data: file, error } = await db.storage.from(BUCKET).download(row.storage_path);
    if (error || !file) {
      console.warn(`  could not read ${row.original_filename ?? row.id}, skipped`);
      continue;
    }
    hashes.set(row.id, hashBytes(Buffer.from(await file.arrayBuffer())));
    if (++read % 25 === 0) console.log(`  hashed ${read}`);
  }

  // Group by album and hash. The oldest in each group stays.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const hash = hashes.get(row.id);
    if (!hash) continue;
    const groupKey = `${row.album_id}|${hash}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  const sets = [...groups.values()].filter((group) => group.length > 1);
  const extra = sets.reduce((sum, group) => sum + group.length - 1, 0);
  console.log(`${sets.length} files uploaded more than once, ${extra} extra copies`);
  for (const group of sets.slice(0, 40)) {
    console.log(`  ${group[0].original_filename ?? group[0].id} ×${group.length}`);
  }
  if (sets.length > 40) console.log(`  …and ${sets.length - 40} more`);

  if (!confirm) {
    console.log("Dry run. Re-run with --confirm to delete the extra copies and record hashes.");
    return;
  }

  for (const [keeper, ...copies] of sets) {
    const copyIds = copies.map((copy) => copy.id);

    const { data: favourites } = await db.from("favourites").select("user_id, club_id").in("media_id", copyIds);
    if (favourites?.length) {
      await db
        .from("favourites")
        .upsert(
          favourites.map((f) => ({ user_id: f.user_id, club_id: f.club_id, media_id: keeper.id })),
          { onConflict: "user_id,media_id", ignoreDuplicates: true },
        );
    }
    await db.from("albums").update({ cover_media_id: keeper.id }).in("cover_media_id", copyIds);

    const paths = copies.flatMap((copy) =>
      [copy.storage_path, copy.thumb_path, copy.display_path, copy.poster_path].filter((p): p is string => Boolean(p)),
    );
    const { error: storageError } = await db.storage.from(BUCKET).remove(paths);
    if (storageError) throw storageError;
    const { error: deleteError } = await db.from("media").delete().in("id", copyIds);
    if (deleteError) throw deleteError;
  }
  console.log(`Deleted ${extra} extra copies.`);

  // Record hashes last, once no two rows in an album share one, or the unique
  // index would refuse the write.
  const deleted = new Set(sets.flatMap(([, ...copies]) => copies.map((copy) => copy.id)));
  let written = 0;
  for (const row of rows) {
    const hash = hashes.get(row.id);
    if (!hash || row.content_hash || deleted.has(row.id)) continue;
    const { error } = await db.from("media").update({ content_hash: hash }).eq("id", row.id);
    if (error) console.warn(`  could not record hash for ${row.id}: ${error.message}`);
    else written++;
  }
  console.log(`Recorded ${written} hashes. Run the face drain to delete the copies' faceprints.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

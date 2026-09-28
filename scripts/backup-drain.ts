/**
 * Copies to R2 whatever the web app couldn't: files too big for one function
 * run (flagged backup_deferred_at), ones that failed five times, or a whole
 * back catalogue after R2 is first switched on.
 *
 *   pnpm backup-drain                    # everything not yet copied
 *   pnpm backup-drain --event demo_umfc  # one event
 *   pnpm backup-drain --dry-run          # just say what it would copy
 *
 * Needs .env.local with the Supabase service role and the four R2_ settings.
 * A local script has no time limit, and every copy is recorded as it lands,
 * so stopping halfway and running it again carries on where it left off.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/db/types";
import { r2Client, r2ConfigFrom, streamUrlToR2 } from "../lib/backup/r2-core";

const BUCKET = "event_media";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config = r2ConfigFrom(process.env);
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  if (!config) throw new Error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
  const dryRun = process.argv.includes("--dry-run");
  const handle = arg("event");

  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const r2 = r2Client(config);

  let eventId: string | null = null;
  if (handle) {
    const { data } = await db.from("events").select("id").eq("handle", handle.toLowerCase()).maybeSingle();
    if (!data) throw new Error(`No event with handle ${handle}`);
    eventId = data.id;
  }

  let copied = 0;
  let failed = 0;
  let bytes = 0;
  for (;;) {
    let query = db
      .from("media")
      .select("id, storage_path, thumb_path, display_path, poster_path, byte_size, backup_attempts")
      .is("backed_up_at", null)
      .eq("status", "ready")
      .order("created_at")
      .limit(100);
    if (eventId) query = query.eq("event_id", eventId);
    const { data: batch, error } = await query;
    if (error) throw error;
    const todo = (batch ?? []).filter((m) => !seen.has(m.id));
    if (todo.length === 0) break;

    for (const m of todo) {
      seen.add(m.id);
      const paths = [m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p));
      if (dryRun) {
        console.log(`would copy ${m.id} (${paths.length} files, ${Math.round((m.byte_size ?? 0) / 1e6)} MB)`);
        continue;
      }
      try {
        for (const path of paths) {
          const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
          if (signError || !signed) throw new Error(`could not sign ${path}: ${signError?.message}`);
          await streamUrlToR2(r2, config, signed.signedUrl, path);
        }
        await db
          .from("media")
          .update({ backed_up_at: new Date().toISOString(), backup_error: null, backup_deferred_at: null })
          .eq("id", m.id);
        copied += 1;
        bytes += m.byte_size ?? 0;
        console.log(`copied ${m.id}`);
      } catch (copyError) {
        failed += 1;
        await db
          .from("media")
          .update({ backup_attempts: m.backup_attempts + 1, backup_error: String(copyError).slice(0, 500) })
          .eq("id", m.id);
        console.error(`failed ${m.id}:`, copyError);
      }
    }
  }
  console.log(dryRun ? `dry run: ${seen.size} items not yet copied` : `copied ${copied} items (${Math.round(bytes / 1e6)} MB), ${failed} failed`);
}

const seen = new Set<string>();

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

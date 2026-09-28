/**
 * Copies an event's files back from the R2 copy into Supabase Storage.
 *
 *   pnpm restore-media --event demo_umfc                  # dry run: what's missing, what R2 has
 *   pnpm restore-media --event demo_umfc --album <id>     # one album
 *   pnpm restore-media --event demo_umfc --media <id>     # one photo
 *   pnpm restore-media --event demo_umfc --confirm        # actually copy back
 *
 * With --confirm it copies back every file of the chosen items that Supabase
 * is missing, rebuilds a missing photo preview from its original when R2 has
 * no copy of it, and takes the chosen items out of Recently deleted: the event
 * itself for a whole event, the album and the photos binned with it for
 * --album, the one photo for --media.
 *
 * It restores files for rows the database still has. If rows are gone too,
 * restore the database from Supabase's daily backup first, then run this.
 * Test it on the demo event once a month: a backup nobody has restored is
 * only a hope.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../lib/db/types";
import { existsInR2, r2Client, r2ConfigFrom, readFromR2 } from "../lib/backup/r2-core";

const BUCKET = "event_media";
const THUMB_SHORT_EDGE = 400;
const THUMB_LONG_CAP = 900;
const DISPLAY_EDGE = 2000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function toBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

function contentTypeOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return (
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime" }[
      ext ?? ""
    ] ?? "application/octet-stream"
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config = r2ConfigFrom(process.env);
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  if (!config) throw new Error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
  const handle = arg("event");
  if (!handle) throw new Error("Usage: pnpm restore-media --event <handle> [--album <id>] [--media <id>] [--confirm]");
  const albumId = arg("album");
  const mediaId = arg("media");
  const confirm = process.argv.includes("--confirm");

  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const r2 = r2Client(config);

  const { data: event } = await db.from("events").select("id, name, deleted_at, logo_path").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!event) throw new Error(`No event with handle ${handle}`);
  console.log(`${confirm ? "Restoring" : "Dry run for"} ${event.name}${event.deleted_at ? " (in Recently deleted)" : ""}`);

  let query = db
    .from("media")
    .select("id, kind, album_id, storage_path, thumb_path, display_path, poster_path, deleted_at")
    .eq("event_id", event.id)
    .order("id");
  if (albumId) query = query.eq("album_id", albumId);
  if (mediaId) query = query.eq("id", mediaId);
  const rows: NonNullable<Awaited<typeof query>["data"]> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`${rows.length} items`);

  let missing = 0;
  let copied = 0;
  let rebuilt = 0;
  let lost = 0;
  for (const m of rows) {
    const folder = m.storage_path.slice(0, m.storage_path.lastIndexOf("/"));
    const { data: present } = await db.storage.from(BUCKET).list(folder, { limit: 20 });
    const inSupabase = new Set((present ?? []).map((o) => `${folder}/${o.name}`));
    const wanted = [m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p));

    for (const path of wanted) {
      if (inSupabase.has(path)) continue;
      missing += 1;
      const inR2 = await existsInR2(r2, config, path);
      const isPreview = path !== m.storage_path;
      if (!confirm) {
        console.log(`  ${path}: missing, ${inR2 ? "in R2" : isPreview && m.kind === "photo" ? "not in R2, will rebuild" : "NOT IN R2"}`);
        continue;
      }
      if (inR2) {
        const body = await readFromR2(r2, config, path);
        if (!body) continue;
        const { error } = await db.storage.from(BUCKET).upload(path, await toBuffer(body), { upsert: true, contentType: contentTypeOf(path) });
        if (error) throw new Error(`upload ${path}: ${error.message}`);
        copied += 1;
      } else if (isPreview && m.kind === "photo" && path.endsWith(".webp")) {
        // Rebuild from the original, the same sizes the uploader makes.
        const originalBody = await readFromR2(r2, config, m.storage_path);
        const original = originalBody ? await toBuffer(originalBody) : null;
        if (!original) {
          lost += 1;
          continue;
        }
        const image = sharp(original).rotate();
        const meta = await image.metadata();
        const w = meta.autoOrient?.width ?? meta.width ?? DISPLAY_EDGE;
        const h = meta.autoOrient?.height ?? meta.height ?? DISPLAY_EDGE;
        const scale = path.endsWith("thumb.webp")
          ? Math.min(1, THUMB_SHORT_EDGE / Math.min(w, h), THUMB_LONG_CAP / Math.max(w, h))
          : Math.min(1, DISPLAY_EDGE / Math.max(w, h));
        const out = await image
          .resize(Math.round(w * scale), Math.round(h * scale))
          .webp({ quality: path.endsWith("thumb.webp") ? 80 : 86 })
          .toBuffer();
        const { error } = await db.storage.from(BUCKET).upload(path, out, { upsert: true, contentType: "image/webp" });
        if (error) throw new Error(`upload ${path}: ${error.message}`);
        rebuilt += 1;
      } else {
        lost += 1;
        console.error(`  ${path}: missing and not in R2`);
      }
    }
  }

  if (event.logo_path && confirm) {
    const { data: logoFolder } = await db.storage.from(BUCKET).list(event.logo_path.slice(0, event.logo_path.lastIndexOf("/")));
    const hasLogo = (logoFolder ?? []).some((o) => event.logo_path?.endsWith(`/${o.name}`));
    if (!hasLogo && (await existsInR2(r2, config, event.logo_path))) {
      const body = await readFromR2(r2, config, event.logo_path);
      if (body) {
        await db.storage.from(BUCKET).upload(event.logo_path, await toBuffer(body), { upsert: true, contentType: contentTypeOf(event.logo_path) });
        copied += 1;
      }
    }
  }

  if (confirm) {
    const now = { deleted_at: null, deleted_by: null };
    if (mediaId) {
      await db.from("media").update(now).eq("id", mediaId).eq("event_id", event.id);
    } else if (albumId) {
      const { data: album } = await db.from("albums").select("deleted_at").eq("id", albumId).eq("event_id", event.id).maybeSingle();
      if (album?.deleted_at) {
        await db.from("media").update(now).eq("album_id", albumId).eq("deleted_at", album.deleted_at);
        await db.from("albums").update(now).eq("id", albumId);
      }
    } else if (event.deleted_at) {
      await db.from("events").update(now).eq("id", event.id);
    }
  }

  console.log(
    confirm
      ? `Copied back ${copied} files, rebuilt ${rebuilt} previews, ${lost} could not be restored.`
      : `${missing} files missing from Supabase. Run again with --confirm to copy them back.`,
  );
  if (lost > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

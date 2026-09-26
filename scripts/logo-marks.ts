/**
 * Makes the 96px badge rendition for club logos uploaded before marks existed.
 * New uploads get one from setClubLogoAction; until this runs, older logos
 * still show, from the full-size original.
 *
 *   pnpm tsx --env-file=.env.local scripts/logo-marks.ts
 *
 * Safe to re-run: it overwrites marks with the same image.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../lib/db/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

// Mirrors LOGO_MARK_SIZE and logoMarkPath in lib/storage, which is server-only.
const BUCKET = "club_media";
const SIZE = 96;
function markPath(logoPath: string): string {
  const slash = logoPath.lastIndexOf("/");
  const base = logoPath.slice(slash + 1).replace(/\.[^.]+$/, "").replace(/^logo/, "mark");
  return `${logoPath.slice(0, slash)}/${base}.webp`;
}

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: clubs, error } = await db.from("clubs").select("handle, logo_path").not("logo_path", "is", null);
  if (error) throw error;
  for (const club of clubs ?? []) {
    const path = club.logo_path!;
    const { data: file } = await db.storage.from(BUCKET).download(path);
    if (!file) {
      console.warn(`${club.handle}: logo missing at ${path}`);
      continue;
    }
    const mark = await sharp(Buffer.from(await file.arrayBuffer()), { density: 300 })
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer();
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(markPath(path), new Uint8Array(mark), { upsert: true, contentType: "image/webp" });
    console.log(`${club.handle}: ${uploadError ? `failed, ${uploadError.message}` : `${Math.round(file.size / 1024)} KB → ${Math.round(mark.length / 1024)} KB`}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

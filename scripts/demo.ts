/**
 * Builds the club the design file is drawn around — UniMelb FC, @umfc — so the
 * screens can be looked at with real content in them.
 *
 *   DEMO_ADMIN_EMAIL=you@example.com pnpm tsx --env-file=.env.local scripts/demo.ts
 *
 * Re-running removes the previous demo club first, so it is safe to repeat.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../lib/db/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.DEMO_ADMIN_EMAIL ?? "mahi.demo@klubbies.test").trim().toLowerCase();
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "club_media";
const HANDLE = "demo_umfc";
const PHOTOS = path.join(process.cwd(), "design/source-photos");

const ALBUMS = [
  { title: "Semester 2 Ball", date: "2026-09-12", type: "formal", count: 6, status: "published" },
  { title: "Grand Final vs Engineering", date: "2026-09-05", type: "sport", count: 4, status: "published" },
  { title: "Trivia Night", date: "2026-09-17", type: "social", count: 3, status: "draft" },
  { title: "Round 7 vs Monash", date: "2026-06-06", type: "sport", count: 3, status: "published" },
  { title: "First Social, Naughtons", date: "2026-04-11", type: "night_out", count: 3, status: "published" },
  { title: "Committee Camp", date: "2026-08-14", type: "camp", count: 2, status: "hidden" },
] as const;

const MEMBERS = [
  ["Mahi Patel", adminEmail],
  ["Lachlan Doyle", "l.doyle@student.unimelb.test"],
  ["Tilly Nguyen", "t.nguyen@student.unimelb.test"],
  ["Ben Okafor", "b.okafor@student.unimelb.test"],
  ["Sofia Marchetti", "s.marchetti@student.unimelb.test"],
  ["Amara Chen", "a.chen@student.unimelb.test"],
  ["Priya Raman", "p.raman@student.unimelb.test"],
  ["Zoe Kaur", "z.kaur@student.unimelb.test"],
] as const;

async function main() {
  const { data: existing } = await db.from("clubs").select("id").eq("handle", HANDLE).maybeSingle();
  if (existing) {
    const { data: old } = await db.from("media").select("storage_path").eq("club_id", existing.id);
    for (const row of old ?? []) {
      const folder = row.storage_path.slice(0, row.storage_path.lastIndexOf("/"));
      await db.storage.from(BUCKET).remove([
        `${folder}/original.jpg`,
        `${folder}/thumb.webp`,
        `${folder}/display.webp`,
      ]);
    }
    await db.from("clubs").delete().eq("id", existing.id);
    console.log("removed the previous demo club");
  }

  const { data: club, error } = await db
    .from("clubs")
    .insert({
      handle: HANDLE,
      name: "UniMelb FC",
      organisation: "The University of Melbourne",
      description: "Every night worth keeping, in one place.",
      accent_colour: "#ec3013",
      billing_status: "comped",
    })
    .select("id")
    .single();
  if (error || !club) throw error;
  await db.rpc("seed_club_roles", { p_club_id: club.id });

  const { data: roles } = await db.from("club_roles").select("id, key, manage_club").eq("club_id", club.id);
  const adminRole = roles?.find((r) => r.manage_club);
  const memberRole = roles?.find((r) => !r.manage_club && r.key === "member") ?? roles?.find((r) => !r.manage_club);

  const files = (await readdir(PHOTOS)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  let photoIndex = 0;
  const next = () => files[photoIndex++ % files.length];

  for (const [i, [name, email]] of MEMBERS.entries()) {
    const isAdmin = i === 0;
    const { data: user } = await db.auth.admin.createUser({ email, email_confirm: true });
    await db.from("memberships").insert({
      club_id: club.id,
      roster_name: name,
      roster_email: email,
      claimed_name: i < 6 ? name : null,
      role: isAdmin ? "club_admin" : "club_member",
      role_id: (isAdmin ? adminRole?.id : memberRole?.id) ?? null,
      status: i < 6 ? "active" : "pending",
      user_id: user?.user?.id ?? null,
      accepted_at: i < 6 ? new Date().toISOString() : null,
      first_seen_at: i < 6 ? new Date().toISOString() : null,
    });
  }

  for (const album of ALBUMS) {
    const { data: row } = await db
      .from("albums")
      .insert({
        club_id: club.id,
        title: album.title,
        event_date: album.date,
        event_type: album.type,
        status: album.status,
        published_at: album.status === "published" ? new Date(`${album.date}T10:00:00+10:00`).toISOString() : null,
        allow_download: true,
        contributor_scope: album.title === "Trivia Night" ? "members" : "managers",
      })
      .select("id")
      .single();
    if (!row) continue;

    for (let n = 0; n < album.count; n++) {
      const source = await readFile(path.join(PHOTOS, next()));
      const mediaId = crypto.randomUUID();
      const folder = `clubs/${club.id}/albums/${row.id}/${mediaId}`;
      const original = await sharp(source).jpeg({ quality: 82 }).toBuffer();
      const thumb = await sharp(source).resize(600, 600, { fit: "cover" }).webp({ quality: 74 }).toBuffer();
      const display = await sharp(source).resize(1800, 1800, { fit: "inside" }).webp({ quality: 80 }).toBuffer();
      const meta = await sharp(display).metadata();

      for (const [name, body, type] of [
        ["original.jpg", original, "image/jpeg"],
        ["thumb.webp", thumb, "image/webp"],
        ["display.webp", display, "image/webp"],
      ] as const) {
        const { error: upErr } = await db.storage.from(BUCKET).upload(`${folder}/${name}`, body, {
          contentType: type,
          upsert: true,
        });
        if (upErr) throw upErr;
      }

      await db.from("media").insert({
        id: mediaId,
        club_id: club.id,
        album_id: row.id,
        kind: "photo",
        storage_path: `${folder}/original.jpg`,
        thumb_path: `${folder}/thumb.webp`,
        display_path: `${folder}/display.webp`,
        width: meta.width ?? null,
        height: meta.height ?? null,
        byte_size: original.length,
        mime_type: "image/jpeg",
        original_filename: `IMG_${4400 + photoIndex}.jpg`,
        captured_at: new Date(`${album.date}T22:${String(10 + n).padStart(2, "0")}:00+10:00`).toISOString(),
        status: "ready",
      });
    }
    console.log(`${album.title}: ${album.count} photos`);
  }

  console.log(`\nDemo club ready at /c/${HANDLE} and /admin/${HANDLE}`);
  console.log(`Admin signs in as ${adminEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

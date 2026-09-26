/**
 * Builds a fictional event, Brisbane Product Summit 2026 (@demo_summit), so the
 * screens can be looked at with content in them. Photos come from
 * design/source-photos, which is gitignored: drop any JPGs in there first.
 *
 *   DEMO_ADMIN_EMAIL=you@example.com pnpm demo
 *
 * Re-running removes the previous demo event first, so it is safe to repeat.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../lib/db/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.DEMO_ADMIN_EMAIL ?? "organiser.demo@klubbies.test").trim().toLowerCase();
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "event_media";
const HANDLE = "demo_summit";
const PHOTOS = path.join(process.cwd(), "design/source-photos");

const EVENT_DAY = "2026-11-14";

const ALBUMS = [
  { title: "Opening keynote", date: EVENT_DAY, count: 5, status: "published", photographer: "Jane Citizen", hour: 9 },
  { title: "Breakout sessions", date: EVENT_DAY, count: 4, status: "published", photographer: "Sam Lee", hour: 11 },
  { title: "Networking drinks", date: EVENT_DAY, count: 5, status: "published", photographer: "Jane Citizen", hour: 18 },
  { title: "Headshot booth", date: EVENT_DAY, count: 3, status: "draft", photographer: "Sam Lee", hour: 14 },
] as const;

// [name, email, role key]
const PEOPLE = [
  ["Alex Morgan", adminEmail, "admin"],
  ["Sam Lee", "sam.lee@photo.example.test", "photographer"],
  ["Priya Raman", "priya.raman@acme.example.test", "member"],
  ["Ben Okafor", "ben.okafor@acme.example.test", "member"],
  ["Sofia Marchetti", "sofia@studio.example.test", "member"],
  ["Tom Walsh", "tom.walsh@acme.example.test", "member"],
] as const;

async function main() {
  const { data: existing } = await db.from("events").select("id").eq("handle", HANDLE).maybeSingle();
  if (existing) {
    const { data: old } = await db.from("media").select("storage_path").eq("event_id", existing.id);
    for (const row of old ?? []) {
      const folder = row.storage_path.slice(0, row.storage_path.lastIndexOf("/"));
      await db.storage.from(BUCKET).remove([
        `${folder}/original.jpg`,
        `${folder}/thumb.webp`,
        `${folder}/display.webp`,
      ]);
    }
    await db.from("events").delete().eq("id", existing.id);
    console.log("removed the previous demo event");
  }

  const { data: event, error } = await db
    .from("events")
    .insert({
      handle: HANDLE,
      name: "Brisbane Product Summit 2026",
      organisation: "Northwind Labs",
      description: "A day of talks, workshops and drinks for product people in Brisbane.",
      accent_colour: "#0e7490",
      billing_status: "comped",
      starts_on: EVENT_DAY,
      venue: "Brisbane Convention Centre",
      access_mode: "link",
      access_ends_at: new Date("2027-02-13T23:59:59+10:00").toISOString(),
    })
    .select("id")
    .single();
  if (error || !event) throw error;
  await db.rpc("seed_event_roles", { p_event_id: event.id });

  const { data: roles } = await db.from("event_roles").select("id, key").eq("event_id", event.id);
  const roleId = (key: string) => roles?.find((r) => r.key === key)?.id ?? null;

  const files = (await readdir(PHOTOS)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  let photoIndex = 0;
  const next = () => files[photoIndex++ % files.length];

  for (const [i, [name, email, key]] of PEOPLE.entries()) {
    const joined = i < 5;
    const { data: created } = await db.auth.admin.createUser({ email, email_confirm: true });
    let userId = created?.user?.id ?? null;
    if (!userId) {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    }
    await db.from("memberships").insert({
      event_id: event.id,
      roster_name: name,
      roster_email: email,
      claimed_name: joined ? name : null,
      role: key === "admin" ? "event_admin" : "event_member",
      role_id: roleId(key),
      status: joined ? "active" : "pending",
      user_id: joined ? userId : null,
      first_seen_at: joined ? new Date().toISOString() : null,
    });
    if (userId) await db.from("users").update({ display_name: name }).eq("id", userId);
  }

  for (const album of ALBUMS) {
    const { data: row } = await db
      .from("albums")
      .insert({
        event_id: event.id,
        title: album.title,
        album_date: album.date,
        status: album.status,
        published_at: album.status === "published" ? new Date(`${album.date}T10:00:00+10:00`).toISOString() : null,
        allow_download: true,
        contributor_scope: "managers",
      })
      .select("id")
      .single();
    if (!row) continue;

    for (let n = 0; n < album.count; n++) {
      const source = await readFile(path.join(PHOTOS, next()));
      const mediaId = crypto.randomUUID();
      const folder = `events/${event.id}/albums/${row.id}/${mediaId}`;
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
        event_id: event.id,
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
        captured_at: new Date(`${album.date}T${String(album.hour).padStart(2, "0")}:${String(10 + n).padStart(2, "0")}:00+10:00`).toISOString(),
        photographer_name: album.photographer,
        status: "ready",
      });
    }
    console.log(`${album.title}: ${album.count} photos`);
  }

  // Queue face indexing, as a real upload would. The hourly cron (or
  // GET /api/cron/hourly with the CRON_SECRET) works through it.
  const { data: photos } = await db.from("media").select("id").eq("event_id", event.id).eq("kind", "photo");
  if (photos?.length) {
    await db.from("face_jobs").insert(photos.map((m) => ({ event_id: event.id, media_id: m.id, kind: "index_media" })));
    console.log(`queued ${photos.length} photos for face indexing`);
  }

  console.log(`\nDemo event ready at /e/${HANDLE} and /admin/${HANDLE}`);
  console.log(`The organiser signs in as ${adminEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

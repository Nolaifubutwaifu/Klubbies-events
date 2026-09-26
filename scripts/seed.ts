/**
 * Seeds two clubs, three members and a dozen sample photos so the UI can be
 * developed without manual setup. Safe to re-run: it removes the previous
 * seed clubs first.
 *
 *   SEED_ADMIN_EMAIL=you@example.com pnpm seed
 *
 * SEED_ADMIN_EMAIL becomes the admin of both clubs so you can sign in with a
 * real inbox. The three members use example.com addresses.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../lib/db/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
if (!adminEmail) throw new Error("Set SEED_ADMIN_EMAIL to the address you will sign in with");

const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "club_media";

const CLUBS = [
  {
    handle: "seed_uq_volleyball",
    name: "UQ Volleyball",
    organisation: "The University of Queensland",
    albums: [
      { title: "Winter Ball", date: "2026-09-12", photos: 5 },
      { title: "Intervarsity Finals", date: "2026-08-09", photos: 3 },
    ],
  },
  {
    handle: "seed_qut_rowing",
    name: "QUT Rowing Club",
    organisation: "Queensland University of Technology",
    albums: [{ title: "Regatta Weekend", date: "2026-08-23", photos: 4 }],
  },
];

const MEMBERS = [
  { name: "Mara Lindqvist", email: "mara@example.com", clubs: ["seed_uq_volleyball"] },
  { name: "Jonas Weber", email: "jonas@example.com", clubs: ["seed_qut_rowing"] },
  { name: "Priya Raman", email: "priya@example.com", clubs: ["seed_uq_volleyball", "seed_qut_rowing"] },
];

const PALETTE = ["#ec3013", "#2d2b2b", "#e15b47", "#605d5d", "#ae1800", "#9b9797"];

async function ensureUser(email: string): Promise<string> {
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  const { data } = await db.from("users").select("id").eq("email", email).single();
  if (!data) throw created.error ?? new Error(`could not create ${email}`);
  return data.id;
}

async function sampleImage(label: string, index: number) {
  const width = index % 3 === 1 ? 1200 : 1800;
  const height = index % 3 === 1 ? 1600 : 1200;
  const a = PALETTE[index % PALETTE.length];
  const b = PALETTE[(index + 2) % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="60" y="${height - 80}" font-family="Helvetica, Arial" font-size="96" font-weight="900" fill="#f3f2f2">${label}</text>
  </svg>`;
  const base = sharp(Buffer.from(svg));
  const [original, thumb, display] = await Promise.all([
    base.clone().jpeg({ quality: 88 }).toBuffer(),
    base.clone().resize(400, 400, { fit: "inside" }).webp({ quality: 80 }).toBuffer(),
    base.clone().resize(2000, 2000, { fit: "inside" }).webp({ quality: 86 }).toBuffer(),
  ]);
  return { original, thumb, display, width, height };
}

async function removeSeedClub(handle: string) {
  const { data: club } = await db.from("clubs").select("id").eq("handle", handle).maybeSingle();
  if (!club) return;
  const { data: media } = await db.from("media").select("storage_path, thumb_path, display_path").eq("club_id", club.id);
  const paths = (media ?? []).flatMap((m) => [m.storage_path, m.thumb_path, m.display_path]).filter((p): p is string => Boolean(p));
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  await db.from("clubs").delete().eq("id", club.id);
}

async function main() {
  const adminId = await ensureUser(adminEmail!);
  await db.from("users").update({ display_name: "Seed Admin" }).eq("id", adminId);

  let photoNumber = 0;
  const clubIds = new Map<string, string>();

  for (const spec of CLUBS) {
    await removeSeedClub(spec.handle);
    const { data: club, error } = await db
      .from("clubs")
      .insert({ handle: spec.handle, name: spec.name, organisation: spec.organisation, created_by: adminId, billing_status: "comped" })
      .select("id")
      .single();
    if (error || !club) throw error;
    clubIds.set(spec.handle, club.id);

    await db.from("memberships").insert({
      club_id: club.id,
      user_id: adminId,
      roster_email: adminEmail!,
      roster_name: "Seed Admin",
      role: "club_admin",
      status: "active",
      first_seen_at: new Date().toISOString(),
    });

    for (const albumSpec of spec.albums) {
      const { data: album } = await db
        .from("albums")
        .insert({
          club_id: club.id,
          title: albumSpec.title,
          event_date: albumSpec.date,
          status: "published",
          published_at: new Date().toISOString(),
          created_by: adminId,
        })
        .select("id")
        .single();
      if (!album) throw new Error("album insert failed");

      for (let i = 0; i < albumSpec.photos; i++) {
        photoNumber++;
        const id = crypto.randomUUID();
        const folder = `clubs/${club.id}/albums/${album.id}/${id}`;
        const image = await sampleImage(`${albumSpec.title} ${i + 1}`, photoNumber);
        await Promise.all([
          db.storage.from(BUCKET).upload(`${folder}/original.jpg`, image.original, { contentType: "image/jpeg", upsert: true }),
          db.storage.from(BUCKET).upload(`${folder}/thumb.webp`, image.thumb, { contentType: "image/webp", upsert: true }),
          db.storage.from(BUCKET).upload(`${folder}/display.webp`, image.display, { contentType: "image/webp", upsert: true }),
        ]);
        const { error: mediaError } = await db.from("media").insert({
          id,
          club_id: club.id,
          album_id: album.id,
          kind: "photo",
          storage_path: `${folder}/original.jpg`,
          thumb_path: `${folder}/thumb.webp`,
          display_path: `${folder}/display.webp`,
          width: image.width,
          height: image.height,
          byte_size: image.original.length,
          mime_type: "image/jpeg",
          original_filename: `IMG_${String(1000 + photoNumber)}.jpg`,
          captured_at: new Date(`${albumSpec.date}T20:${String(10 + i).padStart(2, "0")}:00+10:00`).toISOString(),
          uploaded_by: adminId,
          status: "ready",
        });
        if (mediaError) throw mediaError;
      }
    }
  }

  for (const member of MEMBERS) {
    for (const handle of member.clubs) {
      await db.from("memberships").insert({
        club_id: clubIds.get(handle)!,
        roster_email: member.email,
        roster_name: member.name,
        status: "pending",
        invited_at: new Date().toISOString(),
      });
    }
  }

  console.log(`Seeded ${CLUBS.length} clubs, ${MEMBERS.length} members and ${photoNumber} photos.`);
  console.log(`Sign in as ${adminEmail} at /signin, then open /c/${CLUBS[0].handle}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

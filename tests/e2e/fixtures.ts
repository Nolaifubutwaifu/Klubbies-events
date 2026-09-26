import { createClient } from "@supabase/supabase-js";
import type { APIRequestContext, BrowserContext } from "@playwright/test";
import type { Database } from "../../lib/db/types";

// Test fixtures talk to the real Supabase project with the service role and
// create uniquely named clubs so runs never collide with real data.

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("E2E tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// 1×1 JPEG
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=",
  "base64",
);

export type World = {
  runId: string;
  clubA: { id: string; handle: string; albumId: string; mediaId: string };
  clubB: { id: string; handle: string; albumId: string; mediaId: string };
  memberEmail: string;
  outsiderEmail: string;
};

async function makeClub(runId: string, label: string) {
  const db = admin();
  const handle = `e2e_${runId}_${label}`;
  const { data: club, error } = await db.from("clubs").insert({ handle, name: `E2E ${label} ${runId}` }).select("id").single();
  if (error || !club) throw error;
  const { data: album } = await db
    .from("albums")
    .insert({ club_id: club.id, title: `Album ${label}`, status: "published", published_at: new Date().toISOString() })
    .select("id")
    .single();
  const mediaId = crypto.randomUUID();
  const folder = `clubs/${club.id}/albums/${album!.id}/${mediaId}`;
  for (const name of ["original.jpg", "thumb.webp", "display.webp"]) {
    const { error: uploadError } = await db.storage.from("club_media").upload(`${folder}/${name}`, TINY_JPEG, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;
  }
  await db.from("media").insert({
    id: mediaId,
    club_id: club.id,
    album_id: album!.id,
    kind: "photo",
    storage_path: `${folder}/original.jpg`,
    thumb_path: `${folder}/thumb.webp`,
    display_path: `${folder}/display.webp`,
    width: 1,
    height: 1,
    byte_size: TINY_JPEG.length,
    mime_type: "image/jpeg",
    original_filename: `${label}.jpg`,
    status: "ready",
  });
  return { id: club.id, handle, albumId: album!.id, mediaId };
}

export async function createWorld(): Promise<World> {
  const runId = Math.random().toString(36).slice(2, 8);
  const [clubA, clubB] = await Promise.all([makeClub(runId, "a"), makeClub(runId, "b")]);
  const memberEmail = `member.${runId}@e2e.klubbies.test`;
  const outsiderEmail = `outsider.${runId}@e2e.klubbies.test`;
  await admin().from("memberships").insert({ club_id: clubA.id, roster_email: memberEmail, roster_name: "Mara Lindqvist" });
  return { runId, clubA, clubB, memberEmail, outsiderEmail };
}

export async function destroyWorld(world: World) {
  const db = admin();
  for (const club of [world.clubA, world.clubB]) {
    const folder = `clubs/${club.id}/albums/${club.albumId}/${club.mediaId}`;
    await db.storage.from("club_media").remove([`${folder}/original.jpg`, `${folder}/thumb.webp`, `${folder}/display.webp`]);
    await db.from("clubs").delete().eq("id", club.id);
  }
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.includes(`.${world.runId}@e2e.klubbies.test`)) await db.auth.admin.deleteUser(user.id);
  }
}

/**
 * Signs in through the real verify endpoint. The code is minted with the
 * admin API instead of read from an inbox, and the pending sign-in row is
 * created the same way request_code would.
 */
export async function signIn(context: BrowserContext, request: APIRequestContext, email: string, fullName: string) {
  const db = admin();
  await db.auth.admin.createUser({ email, email_confirm: true });
  await db.from("pending_sign_ins").upsert({
    email,
    claimed_name: fullName,
    flow: "member",
    attempts: 0,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  });
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;

  const baseURL = test_baseURL();
  await context.addCookies([{ name: "kb_signin", value: email, url: baseURL }]);
  const res = await context.request.post("/api/auth/verify_code", { data: { code: data.properties.email_otp } });
  if (!res.ok()) throw new Error(`verify failed: ${res.status()} ${await res.text()}`);
  void request;
  return (await res.json()) as { redirectTo: string };
}

function test_baseURL() {
  return `http://localhost:${process.env.E2E_PORT ?? 3100}`;
}

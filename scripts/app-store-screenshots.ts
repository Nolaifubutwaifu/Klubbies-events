/**
 * App Store screenshots for the 6.3 inch iPhone (1206 × 2622), the size App Store
 * Connect asks for ("iPhone with Dynamic Island, medium display"), from the demo
 * event on a local dev server, as the iPhone app shows them (its user agent,
 * so no payment prompts and the QR scanner button).
 *
 *   pnpm demo            # once, for the demo event
 *   pnpm dev --port 3300 # in another terminal
 *   pnpm tsx --env-file=.env.local scripts/app-store-screenshots.ts
 *
 * Writes PNGs to docs/app-store/screenshots/. Signs in by minting a code with
 * the service role, the way the e2e tests do: a demo attendee for the gallery
 * screens, the demo organiser for the Overview. Face matching needs AWS, so on
 * a local server the attendee is given a selfie and a dozen confirmed matches
 * first (local only), and the Overview's localhost link reads as the live one.
 */
import { mkdir, readFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3300";
const EMAIL = (process.env.DEMO_ADMIN_EMAIL ?? "organiser.demo@klubbies.test").toLowerCase();
const ATTENDEE = { email: "priya.raman@acme.example.test", name: "Priya Raman" };
const LIVE_HOST = "events.klubbies.app";
const HANDLE = "demo_summit";
const OUT = "docs/app-store/screenshots";
const APP_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KlubbiesEventsApp/1.0";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(context: BrowserContext, email = EMAIL, name = "Alex Morgan") {
  const db = admin();
  await db.from("pending_sign_ins").upsert({
    email,
    claimed_name: name,
    flow: "member",
    attempts: 0,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  });
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await context.addCookies([{ name: "kb_signin", value: email, url: BASE }]);
  const res = await context.request.post(`${BASE}/api/auth/verify_code`, { data: { code: data.properties.email_otp } });
  if (!res.ok()) throw new Error(`sign in failed: ${res.status()}`);
}

/**
 * Local only: the demo attendee has read the face notice, has a selfie and is
 * matched in a dozen photos, so Your photos shows what it does. The matches
 * are marked collection "demo" and replaced on each run.
 */
async function seedDemoMatches() {
  if (!/localhost|127\.0\.0\.1/.test(BASE)) return;
  const db = admin();
  const { data: event } = await db.from("events").select("id").eq("handle", HANDLE).single();
  const { data: user } = await db.from("users").select("id").eq("email", ATTENDEE.email).single();
  if (!event || !user) throw new Error("Run pnpm demo first");
  const { data: membership } = await db.from("memberships").select("id").eq("event_id", event.id).eq("user_id", user.id).single();
  if (!membership) throw new Error(`${ATTENDEE.email} isn't in ${HANDLE}`);
  await db.from("memberships").update({ face_notice_ack_at: new Date().toISOString() }).eq("id", membership.id);

  const selfiePath = `${event.id}/selfies/${user.id}-demo.webp`;
  await db.storage.from("event_media").upload(selfiePath, await readFile("public/marketing/selfie.webp"), { upsert: true, contentType: "image/webp" });
  await db.from("media_faces").delete().eq("event_id", event.id).eq("collection_id", "demo");
  await db.from("member_face_profiles").delete().eq("membership_id", membership.id);
  const { data: profile, error } = await db
    .from("member_face_profiles")
    .insert({ event_id: event.id, membership_id: membership.id, user_id: user.id, status: "ready", selfie_path: selfiePath, consent_version: "events-2026-09-27" })
    .select("id")
    .single();
  if (error || !profile) throw error ?? new Error("No profile");

  const { data: photos } = await db
    .from("media")
    .select("id, albums!media_album_id_fkey!inner(status)")
    .eq("event_id", event.id)
    .eq("kind", "photo")
    .eq("status", "ready")
    .eq("albums.status", "published")
    .order("sort_at")
    .limit(12);
  const box = { Left: 0.35, Top: 0.2, Width: 0.3, Height: 0.4 };
  for (const photo of photos ?? []) {
    const { data: face } = await db
      .from("media_faces")
      .insert({ event_id: event.id, media_id: photo.id, collection_id: "demo", rekognition_face_id: `demo-${photo.id}`, bounding_box: box })
      .select("id")
      .single();
    if (!face) continue;
    await db.from("face_matches").insert({
      event_id: event.id,
      media_id: photo.id,
      media_face_id: face.id,
      profile_id: profile.id,
      similarity: 99,
      state: "confirmed",
      bounding_box: box,
      decided_at: new Date().toISOString(),
    });
  }
  console.log(`demo attendee matched in ${photos?.length ?? 0} photos`);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Images fade in over 150ms; let every one finish. Lazy images in a closed
  // fold-out never load, so each gets five seconds at most.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? null
          : Promise.race([new Promise((resolve) => (img.onload = img.onerror = resolve)), new Promise((resolve) => setTimeout(resolve, 5000))]),
      ),
    );
  });
  // The dev-mode indicator is not part of the product.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(400);
}

async function shoot(page: Page, name: string, path: string, prepare?: (page: Page) => Promise<void>) {
  await page.goto(`${BASE}${path}`);
  await settle(page);
  if (prepare) await prepare(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${name}.png`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  // 402 × 874 points at 3x: 1206 × 2622, iPhone 17 / 16 Pro.
  const device = { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: APP_UA };

  // Signed out first: the event's join screen, which the QR scanner opens.
  const guest = await browser.newContext(device);
  const guestPage = await guest.newPage();
  await shoot(guestPage, "05-join", `/signin?event=${HANDLE}`);
  await guest.close();

  // The gallery, as an attendee sees it.
  await seedDemoMatches();
  const context = await browser.newContext(device);
  await signIn(context, ATTENDEE.email, ATTENDEE.name);
  const page = await context.newPage();

  await shoot(page, "01-event", `/e/${HANDLE}`);
  await shoot(page, "02-your-photos", `/e/${HANDLE}/me`);

  const db = admin();
  const { data: event } = await db.from("events").select("id").eq("handle", HANDLE).single();
  const { data: album } = await db
    .from("albums")
    .select("id")
    .eq("event_id", event!.id)
    .eq("status", "published")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  await shoot(page, "03-album", `/e/${HANDLE}/a/${album!.id}`);
  const { data: photo } = await db
    .from("media")
    .select("id")
    .eq("album_id", album!.id)
    .eq("status", "ready")
    .order("sort_at")
    .limit(1)
    .single();
  await shoot(page, "04-viewer", `/e/${HANDLE}/a/${album!.id}/${photo!.id}`);

  // The organiser's Overview.
  const organiser = await browser.newContext(device);
  await signIn(organiser);
  const organiserPage = await organiser.newPage();
  await shoot(organiserPage, "06-organiser", `/admin/${HANDLE}`, async (p) => {
    await p.evaluate((host) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.includes("localhost:3300")) node.textContent = node.textContent.replace("localhost:3300", host);
      }
    }, LIVE_HOST);
  });

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

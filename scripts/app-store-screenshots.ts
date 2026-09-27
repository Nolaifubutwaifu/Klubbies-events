/**
 * App Store screenshots for the 6.9 inch iPhone (1320 × 2868), from the demo
 * event on a local dev server, as the iPhone app shows them (its user agent,
 * so no payment prompts and the QR scanner button).
 *
 *   pnpm demo            # once, for the demo event
 *   pnpm dev --port 3300 # in another terminal
 *   pnpm tsx --env-file=.env.local scripts/app-store-screenshots.ts
 *
 * Writes PNGs to docs/app-store/screenshots/. Signs in the demo organiser by
 * minting a code with the service role, the way the e2e tests do.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3300";
const EMAIL = (process.env.DEMO_ADMIN_EMAIL ?? "organiser.demo@klubbies.test").toLowerCase();
const HANDLE = "demo_summit";
const OUT = "docs/app-store/screenshots";
const APP_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KlubbiesEventsApp/1.0";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(context: BrowserContext) {
  const db = admin();
  await db.from("pending_sign_ins").upsert({
    email: EMAIL,
    claimed_name: "Alex Morgan",
    flow: "member",
    attempts: 0,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  });
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (error) throw error;
  await context.addCookies([{ name: "kb_signin", value: EMAIL, url: BASE }]);
  const res = await context.request.post(`${BASE}/api/auth/verify_code`, { data: { code: data.properties.email_otp } });
  if (!res.ok()) throw new Error(`sign in failed: ${res.status()}`);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Images fade in over 150ms; let every one finish.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : new Promise((resolve) => (img.onload = img.onerror = resolve)))),
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
  const device = { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: APP_UA };

  // Signed out first: the event's join screen, which the QR scanner opens.
  const guest = await browser.newContext(device);
  const guestPage = await guest.newPage();
  await shoot(guestPage, "05-join", `/signin?event=${HANDLE}`);
  await guest.close();

  const context = await browser.newContext(device);
  await signIn(context);
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
  await shoot(page, "06-organiser", `/admin/${HANDLE}`);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

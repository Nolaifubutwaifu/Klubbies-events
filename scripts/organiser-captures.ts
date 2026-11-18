/**
 * Desktop captures of the demo event's organiser pages (1920 × 1080), for the
 * marketing demo video. Local only: signs in as the demo organiser by minting a
 * code with the service role, the way app-store-screenshots.ts does, and only
 * views pages. Never opens the usage report or billing.
 *
 *   pnpm demo            # once, for the demo event
 *   pnpm dev --port 3300 # in another terminal
 *   pnpm tsx --env-file=.env.local scripts/organiser-captures.ts [out-dir]
 *
 * Writes <name>.png (the 1920 × 1080 window) and <name>-fullpage.png. Run the dev server with
 * APP_URL=https://events.klubbies.app so links and QR codes show the live address.
 */
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3300";
const HANDLE = "demo_summit";
const EMAIL = (process.env.DEMO_ADMIN_EMAIL ?? "organiser.demo@klubbies.test").toLowerCase();
const OUT = process.argv[2] ?? path.join(os.homedir(), "klubbies-claude-kit/inputs/screen-captures");

// [file, route, text to scroll to, disclosures to open, render as printed]
const PAGES: [name: string, route: string, scrollTo?: string, open?: string[], print?: boolean][] = [
  ["02-branding", `/admin/${HANDLE}/settings`, undefined, ["Details and colour", "Logo"]],
  ["03-photographer-link", `/admin/${HANDLE}/photographers`],
  ["04-poster", `/admin/${HANDLE}/share/poster`, undefined, undefined, true],
  ["05-announcement-email", `/admin/${HANDLE}/share`, "Announcement"],
  ["06-attendees", `/admin/${HANDLE}/attendees`],
  ["07-downloads", `/admin/${HANDLE}/activity?action=download`],
];

if (!/localhost|127\.0\.0\.1/.test(BASE) || !/localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Local only: point BASE and NEXT_PUBLIC_SUPABASE_URL at localhost");
}
if (PAGES.some(([, r]) => /usage|billing/.test(r))) throw new Error("Never capture the usage report or billing");

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await signIn(context);
  const page = await context.newPage();
  for (const [name, route, scrollTo, open, print] of PAGES) {
    await page.emulateMedia({ media: print ? "print" : "screen" });
    const res = await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    for (const title of open ?? []) {   // expand a settings section; nothing is saved
      await page.getByText(title, { exact: true }).first().click();
      await page.waitForTimeout(400);
    }
    if (scrollTo) {
      const el = page.getByText(scrollTo, { exact: false }).first();
      if (await el.count()) await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    await page.screenshot({ path: path.join(OUT, `${name}-fullpage.png`), fullPage: true });
    console.log(name, res?.status(), page.url().replace(BASE, ""));
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

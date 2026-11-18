/**
 * Page speed on a phone over mobile data, for signed-in pages PageSpeed
 * Insights can't reach. iPhone-sized Chromium with throttled 4G (1.6 Mbps
 * down, 750 kbps up, 150 ms RTT) and a 4x slower CPU, each page loaded 3
 * times from cold, median reported. "server s" is request sent to first byte.
 *
 *   KBLT_SECRETS=/path/lt-secrets.json KBLT_EVENT=load_test_nov18 \
 *   KBLT_ALBUM=<album uuid> KBLT_MEDIA_ID=<one photo uuid> \
 *   pnpm tsx scripts/speedtest.ts
 *
 * Signs in as loadtest-001 through the password route (no email sent).
 * Pages without a session (home, pricing) also work: KBLT_PUBLIC=1.
 */
import { readFileSync } from "node:fs";
import { chromium, devices, type Page } from "@playwright/test";

const BASE = process.env.KBLT_BASE ?? "https://events.klubbies.app";
const EVENT = process.env.KBLT_EVENT ?? "";
const ALBUM = process.env.KBLT_ALBUM ?? "";
const MEDIA_ID = process.env.KBLT_MEDIA_ID ?? "";
const RUNS = 3;

const pages: Record<string, string> = process.env.KBLT_PUBLIC
  ? { home: "/", pricing: "/pricing", "how it works": "/how-it-works", "face search privacy": "/face-search-privacy" }
  : {
      event: `/e/${EVENT}`,
      album: `/e/${EVENT}/a/${ALBUM}`,
      ...(MEDIA_ID ? { viewer: `/e/${EVENT}/a/${ALBUM}/${MEDIA_ID}` } : {}),
      "your photos": `/e/${EVENT}/me`,
    };

type Run = { load: number; ttfb: number; fcp: number; lcp: number; kb: number; requests: number; status: number };

async function measure(page: Page, path: string): Promise<Run> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number };
    w.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  let bytes = 0;
  let requests = 0;
  page.on("requestfinished", async (req) => {
    requests++;
    const sizes = await req.sizes().catch(() => null);
    bytes += sizes ? sizes.responseBodySize + sizes.responseHeadersSize : 0;
  });
  const start = Date.now();
  const res = await page.goto(BASE + path, { waitUntil: "load", timeout: 90_000 });
  const load = Date.now() - start;
  await page.waitForTimeout(2500); // let LCP settle after late images
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    return { ttfb: nav.responseStart - nav.requestStart, fcp, lcp: (window as unknown as { __lcp: number }).__lcp };
  });
  return { load, ...timing, kb: Math.round(bytes / 1024), requests, status: res?.status() ?? 0 };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  const browser = await chromium.launch();
  let cookies: { name: string; value: string; domain: string; path: string }[] = [];
  if (!process.env.KBLT_PUBLIC) {
    const { password } = JSON.parse(readFileSync(process.env.KBLT_SECRETS ?? "", "utf8")) as { password: string };
    const res = await fetch(`${BASE}/api/auth/password_signin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "loadtest-001@klubbies.app", password, event: EVENT }),
    });
    if (!res.ok) throw new Error(`sign-in ${res.status} ${await res.text()}`);
    const domain = new URL(BASE).hostname;
    cookies = res.headers.getSetCookie().map((line) => {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain, path: "/" };
    });
  }

  const rows = [];
  for (const [name, path] of Object.entries(pages)) {
    const runs: Run[] = [];
    for (let i = 0; i < RUNS; i++) {
      // Fresh context each run: cold cache, like a guest scanning the QR code.
      const context = await browser.newContext({ ...devices["iPhone 13"] });
      if (cookies.length) await context.addCookies(cookies);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      runs.push(await measure(page, path));
      await context.close();
    }
    const s = (k: keyof Run) => median(runs.map((r) => r[k]));
    rows.push({
      page: name,
      status: s("status"),
      "server s": +(s("ttfb") / 1000).toFixed(2),
      "FCP s": +(s("fcp") / 1000).toFixed(2),
      "LCP s": +(s("lcp") / 1000).toFixed(2),
      "fully loaded s": +(s("load") / 1000).toFixed(2),
      KB: s("kb"),
      requests: s("requests"),
    });
  }
  await browser.close();
  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

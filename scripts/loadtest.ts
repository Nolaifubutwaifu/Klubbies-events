/**
 * Load test for a busy event night: sign-ins, browsing, member and
 * photographer uploads, videos and album zips against a real deployment.
 *
 * It only touches an event whose handle starts with "load_test" and users
 * named loadtest-NNN@klubbies.app, which an operator creates first with SQL
 * (see the 17 Nov 2026 run in docs/reports). Sign-in uses the password route,
 * so no emails are sent.
 *
 *   KBLT_ALLOW_PRODUCTION=yes-max-approved \
 *   KBLT_SECRETS=/path/lt-secrets.json KBLT_MEDIA=/path/ltmedia \
 *   KBLT_EVENT=load_test_nov17 KBLT_ALBUM=<album uuid> \
 *   pnpm tsx scripts/loadtest.ts
 *
 * lt-secrets.json: { "password": "...", "links": [{ "token": "...", "hash": "..." }] }
 * ltmedia: p000.jpg..p359.jpg, v00.mp4..v11.mp4, thumb.webp, display.webp, poster.jpg
 * Optional per photo: p0000.thumb.webp + p0000.display.webp and manifest.json
 * { "p0000.jpg": [width, height] }. Face search indexes the display copy, so a
 * face test needs real per-photo derivatives, not the shared display.webp.
 *
 * KBLT_BULK=1: every photo in KBLT_MEDIA through the photographer links (6 at a
 * time per link) while 150 guests browse every 2 minutes, then every zip part
 * of the album downloaded in full to KBLT_ZIP_DIR (check with unzip -t).
 * KBLT_ZIP_PARTS=8,12: only those zip parts, timed and saved to KBLT_ZIP_DIR.
 *
 * Stop rule: a stage with more than 1% failures in any operation ends the run.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { Upload } from "tus-js-client";

const BASE = process.env.KBLT_BASE ?? "https://events.klubbies.app";
const SUPABASE = process.env.KBLT_SUPABASE ?? "https://yfdglvhhakbuahyfrihs.supabase.co";
const STORAGE = SUPABASE.replace(".supabase.co", ".storage.supabase.co");
const ANON = process.env.KBLT_ANON_KEY ?? "";
const EVENT = process.env.KBLT_EVENT ?? "";
const ALBUM = process.env.KBLT_ALBUM ?? "";
const MEDIA = process.env.KBLT_MEDIA ?? "";
const OUT = process.env.KBLT_OUT ?? "loadtest-results.json";
const secrets = JSON.parse(readFileSync(process.env.KBLT_SECRETS ?? "", "utf8")) as {
  password: string;
  links: { token: string }[];
};

if (!EVENT.startsWith("load_test")) throw new Error("KBLT_EVENT must start with load_test");
if (BASE.includes("events.klubbies.app") && process.env.KBLT_ALLOW_PRODUCTION !== "yes-max-approved") {
  throw new Error("Production needs KBLT_ALLOW_PRODUCTION=yes-max-approved");
}

// ---------- measurements ----------

type Sample = { op: string; ms: number; ok: boolean; status?: number; error?: string; stage: string; at: number };
const samples: Sample[] = [];
let stage = "setup";

async function timed<T>(op: string, fn: () => Promise<T>): Promise<T | null> {
  const start = Date.now();
  try {
    const value = await fn();
    samples.push({ op, ms: Date.now() - start, ok: true, stage, at: start });
    return value;
  } catch (error) {
    const e = error as { status?: number; message?: string };
    samples.push({ op, ms: Date.now() - start, ok: false, status: e.status, error: String(e.message ?? error).slice(0, 200), stage, at: start });
    return null;
  }
}

function fail(status: number, text: string): never {
  throw Object.assign(new Error(`${status} ${text.slice(0, 160)}`), { status });
}

function pct(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function summary(filter: (s: Sample) => boolean) {
  const ops = new Map<string, Sample[]>();
  for (const s of samples.filter(filter)) ops.set(s.op, [...(ops.get(s.op) ?? []), s]);
  return [...ops.entries()].map(([op, list]) => {
    const ok = list.filter((s) => s.ok);
    const failed = list.filter((s) => !s.ok);
    return {
      op,
      count: list.length,
      failed: failed.length,
      failRate: +(failed.length / list.length).toFixed(4),
      p50: pct(ok.map((s) => s.ms), 50),
      p95: pct(ok.map((s) => s.ms), 95),
      max: Math.max(0, ...ok.map((s) => s.ms)),
      errors: [...new Set(failed.map((s) => s.error))].slice(0, 5),
    };
  });
}

function printStage(name: string) {
  console.log(`\n=== ${name} ===`);
  console.table(summary((s) => s.stage === name).map(({ errors, ...row }) => ({ ...row, firstError: errors[0] ?? "" })));
}

async function pool<T>(limit: number, items: T[], fn: (item: T, i: number) => Promise<unknown>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

// ---------- a signed-in guest ----------

class Guest {
  cookies = new Map<string, string>();
  constructor(readonly n: number) {}
  get email() {
    return `loadtest-${String(this.n).padStart(3, "0")}@klubbies.app`;
  }

  private absorb(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    headers.set("user-agent", "KlubbiesLoadTest/1 (Max approved, 17 Nov 2026)");
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    this.absorb(res);
    return res;
  }

  /** The Supabase access token from the session cookie, for TUS uploads. */
  accessToken(): string {
    const base = [...this.cookies.keys()].find((k) => /^sb-.*-auth-token(\.0)?$/.test(k))?.replace(/\.0$/, "");
    if (!base) throw new Error("no session cookie");
    let raw = this.cookies.get(base) ?? "";
    if (!raw) for (let i = 0; this.cookies.has(`${base}.${i}`); i++) raw += this.cookies.get(`${base}.${i}`);
    raw = decodeURIComponent(raw);
    const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : raw;
    return (JSON.parse(json) as { access_token: string }).access_token;
  }

  async signIn() {
    const res = await this.fetch("/api/auth/password_signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email, password: secrets.password, event: EVENT }),
    });
    if (!res.ok) fail(res.status, await res.text());
    this.accessToken();
  }

  async page(path: string) {
    const res = await this.fetch(path);
    const body = await res.text();
    if (res.status !== 200) fail(res.status, body);
  }

  async json(path: string, body: unknown) {
    const res = await this.fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) fail(res.status, text);
    return JSON.parse(text);
  }
}

// ---------- media ----------

const files = readdirSync(MEDIA);
const photos = files.filter((f) => /^p\d+\.jpg$/.test(f)).sort();
const videos = files.filter((f) => /^v\d+\.mp4$/.test(f)).sort();
const thumb = readFileSync(`${MEDIA}/thumb.webp`);
const display = readFileSync(`${MEDIA}/display.webp`);
const poster = readFileSync(`${MEDIA}/poster.jpg`);
const uploaded: string[] = [];
const manifest: Record<string, [number, number]> = files.includes("manifest.json")
  ? JSON.parse(readFileSync(`${MEDIA}/manifest.json`, "utf8"))
  : {};

function load(name: string) {
  const bytes = readFileSync(`${MEDIA}/${name}`);
  const own = (kind: string) => {
    const file = name.replace(/\.jpg$/, `.${kind}.webp`);
    return files.includes(file) ? readFileSync(`${MEDIA}/${file}`) : null;
  };
  const [width, height] = manifest[name] ?? [2400, 1800];
  return {
    name,
    bytes,
    hash: createHash("sha256").update(bytes).digest("hex"),
    thumb: own("thumb") ?? thumb,
    display: own("display") ?? display,
    width,
    height,
  };
}

async function putSigned(url: string, bytes: Buffer, type: string) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": type, "x-upsert": "true", ...(ANON ? { apikey: ANON } : {}) },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) fail(res.status, await res.text());
}

function tus(bytes: Buffer, ticket: { bucket: string; storagePath: string; mimeType: string; mediaId: string }, token: string) {
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(bytes, {
      endpoint: `${STORAGE}/storage/v1/upload/resumable`,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 2000, 5000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      metadata: { bucketName: ticket.bucket, objectName: ticket.storagePath, contentType: ticket.mimeType, cacheControl: "3600" },
      headers: { authorization: `Bearer ${token}`, "x-upsert": "true", ...(ANON ? { apikey: ANON } : {}) },
      onSuccess: () => resolve(),
      onError: (error) => reject(error),
    });
    upload.start();
  });
}

/** What an attendee's phone does: ticket, TUS original, derivatives, finalize. */
async function memberUpload(guest: Guest, name: string) {
  const file = load(name);
  await timed("member_upload", async () => {
    const ticket = await guest.json("/api/media/upload_ticket", {
      albumId: ALBUM,
      filename: file.name,
      mimeType: "image/jpeg",
      byteSize: file.bytes.length,
      contentHash: file.hash,
    });
    if (ticket.duplicate) return;
    await tus(file.bytes, ticket, guest.accessToken());
    await putSigned(ticket.signed[ticket.derivatives.thumb].signedUrl, file.thumb, "image/webp");
    await putSigned(ticket.signed[ticket.derivatives.display].signedUrl, file.display, "image/webp");
    await guest.json(`/api/media/${ticket.mediaId}/finalize`, { width: file.width, height: file.height, durationSeconds: null, capturedAt: null });
    uploaded.push(ticket.mediaId);
  });
}

/** What a photographer's laptop does through their upload link. */
async function photographerUpload(token: string, name: string) {
  const file = load(name);
  const video = name.endsWith(".mp4");
  await timed(video ? "photographer_video" : "photographer_photo", async () => {
    const post = async (path: string, body: unknown) => {
      const res = await fetch(BASE + path, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "KlubbiesLoadTest/1" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) fail(res.status, text);
      return JSON.parse(text);
    };
    const ticket = await post(`/api/guest/${token}/ticket`, {
      filename: file.name,
      mimeType: video ? "video/mp4" : "image/jpeg",
      byteSize: file.bytes.length,
      contentHash: file.hash,
    });
    if (ticket.duplicate) return;
    const signedUrl = (path: string) =>
      `${STORAGE}/storage/v1/object/upload/sign/${ticket.bucket}/${ticket.signed[path].path}?token=${ticket.signed[path].token}`;
    await putSigned(signedUrl(ticket.storagePath), file.bytes, ticket.mimeType);
    if (video) await putSigned(signedUrl(ticket.derivatives.poster), poster, "image/jpeg");
    await putSigned(signedUrl(ticket.derivatives.thumb), video ? thumb : file.thumb, "image/webp");
    await putSigned(signedUrl(ticket.derivatives.display), video ? display : file.display, "image/webp");
    await post(`/api/guest/${token}/finalize/${ticket.mediaId}`, {
      width: video ? 1920 : file.width,
      height: video ? 1080 : file.height,
      durationSeconds: video ? 20 : null,
      capturedAt: null,
    });
    uploaded.push(ticket.mediaId);
  });
}

/** Opening the event, the album, and the thumbnails a phone would request. */
async function browse(guest: Guest) {
  await timed("page_event", () => guest.page(`/e/${EVENT}`));
  await timed("page_album", () => guest.page(`/e/${EVENT}/a/${ALBUM}`));
  const ids = uploaded.slice(-60);
  if (ids.length) await timed("sign_thumbs", () => guest.json("/api/media/sign", { mediaIds: ids, variant: "thumb" }));
  if (ids.length) await timed("page_viewer", () => guest.page(`/e/${EVENT}/a/${ALBUM}/${ids[ids.length - 1]}`));
}

/**
 * Starts an album zip and reads it for up to `seconds`, then stops: enough to
 * see the function start streaming under load without pulling gigabytes here.
 */
async function zip(guest: Guest, seconds: number) {
  let bytes = 0;
  const start = Date.now();
  await timed("zip_first_byte", async () => {
    const res = await guest.fetch(`/api/albums/${ALBUM}/zip`);
    if (res.status !== 200 || !res.body) fail(res.status, await res.text());
    const reader = res.body.getReader();
    const first = await reader.read();
    bytes += first.value?.length ?? 0;
    void (async () => {
      while (Date.now() - start < seconds * 1000) {
        const chunk = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (chunk.done) break;
        bytes += chunk.value?.length ?? 0;
      }
      await reader.cancel().catch(() => undefined);
      samples.push({ op: "zip_mb_per_s", ms: Math.round((bytes / 1e6 / ((Date.now() - start) / 1000)) * 100) / 100, ok: bytes > 0, stage, at: start });
    })();
  });
}

/** Every zip part of the album, read to the end and saved, as an attendee's "Download all" would. */
async function fullZip(guest: Guest, dir: string, only?: number[]) {
  mkdirSync(dir, { recursive: true });
  for (let i = 0; only ? i < only.length : true; i++) {
    const part = only ? only[i] : i;
    const start = Date.now();
    const res = await guest.fetch(`/api/albums/${ALBUM}/zip?part=${part}`);
    if (res.status !== 200 || !res.body) {
      console.log(`zip part ${part}: ${res.status}, stopping`);
      return;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(`${dir}/part-${String(part).padStart(2, "0")}.zip`, bytes);
    samples.push({ op: "zip_full_part", ms: Date.now() - start, ok: bytes.length > 0, stage, at: start });
    console.log(`zip part ${part}: ${(bytes.length / 1e6).toFixed(0)} MB in ${((Date.now() - start) / 1000).toFixed(0)} s`);
  }
}

function overLimit(name: string) {
  const bad = summary((s) => s.stage === name && s.op !== "zip_mb_per_s").filter((r) => r.failRate > 0.01);
  if (bad.length) console.log(`STOP: ${bad.map((r) => `${r.op} ${r.failed}/${r.count}`).join(", ")}`);
  return bad.length > 0;
}

// ---------- the run ----------

async function main() {
  const guests = Array.from({ length: 150 }, (_, i) => new Guest(i + 1));
  const links = secrets.links.map((l) => l.token);
  const t0 = Date.now();

  if (process.env.KBLT_PROBE) {
    // One of everything, to check the harness itself before a real run.
    stage = "probe";
    await timed("sign_in", () => guests[0].signIn());
    await memberUpload(guests[0], photos[0]);
    await photographerUpload(links[0], photos[1]);
    await browse(guests[0]);
    await zip(guests[0], 5);
    await new Promise((r) => setTimeout(r, 6000));
    printStage(stage);
    for (const s of samples.filter((x) => !x.ok)) console.log(s.op, s.error);
    return finish(t0);
  }

  if (process.env.KBLT_ZIP_PARTS) {
    // Times chosen zip parts only (e.g. "8,12"), to compare zip speed after a change.
    stage = `zip parts ${process.env.KBLT_ZIP_PARTS}`;
    await timed("sign_in", () => guests[0].signIn());
    await fullZip(guests[0], process.env.KBLT_ZIP_DIR ?? "zip-parts", process.env.KBLT_ZIP_PARTS.split(",").map(Number));
    printStage(stage);
    return finish(t0);
  }

  if (process.env.KBLT_BROWSE) {
    // Reading only, so this machine's upload link can't be the bottleneck.
    stage = "browse: 150 guests sign in at 10 at a time";
    await pool(10, guests, (g) => timed("sign_in", () => g.signIn()));
    printStage(stage);
    stage = "browse: 150 guests open event, album, viewer, twice";
    uploaded.push(...(process.env.KBLT_MEDIA_IDS ?? "").split(",").filter(Boolean));
    const signedIn = guests.filter((g) => g.cookies.size > 0);
    await pool(50, [...signedIn, ...signedIn], (g) => browse(g));
    printStage(stage);
    return finish(t0);
  }

  if (process.env.KBLT_BULK) {
    stage = "bulk: 150 guests sign in at 10 at a time";
    await pool(10, guests, (g) => timed("sign_in", () => g.signIn()));
    printStage(stage);
    const signedIn = guests.filter((g) => g.cookies.size > 0);
    stage = `bulk: ${photos.length} photos via ${links.length} photographer links, 150 guests browsing`;
    console.log(`\n${stage}`);
    let uploading = true;
    const sleep = async (ms: number) => {
      for (const end = Date.now() + ms; uploading && Date.now() < end; ) await new Promise((r) => setTimeout(r, 2000));
    };
    await Promise.all([
      (async () => {
        let done = 0;
        await pool(6 * links.length, photos, async (p, i) => {
          await photographerUpload(links[i % links.length], p);
          if (++done % 100 === 0) console.log(`${done}/${photos.length} uploaded, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
        });
        uploading = false;
      })(),
      (async () => {
        while (uploading) {
          await pool(50, signedIn, (g) => browse(g));
          await sleep(120_000);
        }
      })(),
      (async () => {
        await sleep(600_000);
        if (uploading) await Promise.all(guests.slice(0, 10).map((g) => zip(g, 45)));
      })(),
    ]);
    printStage(stage);
    stage = "bulk: 150 guests browse the finished album";
    await pool(50, signedIn, (g) => browse(g));
    printStage(stage);
    if (process.env.KBLT_ZIP_DIR) {
      stage = "bulk: full album zip";
      await fullZip(guests[0], process.env.KBLT_ZIP_DIR);
      printStage(stage);
    }
    return finish(t0);
  }

  stage = "1: 10 guests, 20 photos";
  console.log(`\n${stage}`);
  await pool(5, guests.slice(0, 10), (g) => timed("sign_in", () => g.signIn()));
  await pool(10, guests.slice(0, 10), async (g, i) => {
    await memberUpload(g, photos[i * 2]);
    await memberUpload(g, photos[i * 2 + 1]);
  });
  await pool(10, guests.slice(0, 10), (g) => browse(g));
  printStage(stage);
  if (overLimit(stage)) return finish(t0);

  stage = "2: 50 guests, 100 photos, 3 zips";
  console.log(`\n${stage}`);
  await pool(10, guests.slice(10, 50), (g) => timed("sign_in", () => g.signIn()));
  await Promise.all([
    pool(20, photos.slice(20, 60), (p, i) => memberUpload(guests[10 + i], p)),
    pool(6, photos.slice(60, 120), (p, i) => photographerUpload(links[i % 3], p)),
    pool(25, guests.slice(0, 50), (g) => browse(g)),
    ...guests.slice(0, 3).map((g) => zip(g, 30)),
  ]);
  printStage(stage);
  if (overLimit(stage)) return finish(t0);
  // Stage 3 uploads as guests 1 to 70, so they must be signed in first. The
  // 17 Nov run raced this and counted 20 "Album not found" as failures.
  await pool(10, guests.slice(50, 70), (g) => timed("sign_in", () => g.signIn()));

  stage = "3: 150 guests, 70 uploading, 240 photos, 12 videos, 15 zips";
  console.log(`\n${stage}`);
  await Promise.all([
    pool(25, guests.slice(70, 150), (g) => timed("sign_in", () => g.signIn())),
    pool(70, photos.slice(120, 260), (p, i) => memberUpload(guests[i % 70], p)),
    pool(6, photos.slice(260, 360), (p, i) => photographerUpload(links[i % 3], p)),
    pool(3, videos, (v, i) => photographerUpload(links[i % 3], v)),
    (async () => {
      await new Promise((r) => setTimeout(r, 20_000));
      await Promise.all(guests.slice(0, 15).map((g) => zip(g, 45)));
    })(),
    (async () => {
      await new Promise((r) => setTimeout(r, 30_000));
      await pool(50, guests.filter((g) => g.cookies.size > 0), (g) => browse(g));
      await pool(50, guests.filter((g) => g.cookies.size > 0), (g) => browse(g));
    })(),
  ]);
  await new Promise((r) => setTimeout(r, 50_000));
  printStage(stage);
  overLimit(stage);
  finish(t0);
}

function finish(t0: number) {
  const result = {
    base: BASE,
    event: EVENT,
    minutes: +((Date.now() - t0) / 60000).toFixed(1),
    uploaded: uploaded.length,
    stages: [...new Set(samples.map((s) => s.stage))].map((name) => ({ name, ops: summary((s) => s.stage === name) })),
    samples,
  };
  writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log(`\nDone in ${result.minutes} min, ${uploaded.length} files uploaded. Results: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

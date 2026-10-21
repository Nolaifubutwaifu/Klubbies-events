import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { presignR2, r2Client, type R2Config } from "@/lib/backup/r2-core";
import { buildCsp, permissionsPolicy, reportingEndpoints } from "@/lib/security/csp";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "R2_ENDPOINT",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "VERCEL_ENV",
  "APP_URL",
  "NODE_ENV",
] as const;

const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(key: string, value: string | undefined) {
  // NODE_ENV is typed readonly. Tests still need to flip it: buildCsp reads it live.
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

afterEach(() => {
  for (const key of ENV_KEYS) setEnv(key, saved[key]);
});

function useEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) setEnv(key, undefined);
  for (const [key, value] of Object.entries(values)) setEnv(key, value);
}

const SUPABASE = "https://yfdglvhhakbuahyfrihs.supabase.co";
const ACCOUNT = "abc123def4567890abc123def4567890";
const BUCKET = "klubbies-events-backup";

describe("content security policy", () => {
  it("names the origins the browser actually uses", () => {
    useEnv({
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
      R2_ACCOUNT_ID: ACCOUNT,
      R2_BUCKET: BUCKET,
      APP_URL: "https://events.klubbies.app",
      NODE_ENV: "production",
    });

    expect(buildCsp("NONCE")).toBe(
      "default-src 'self'; " +
        "script-src 'self' 'nonce-NONCE' 'strict-dynamic' 'report-sample' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        `img-src 'self' data: blob: ${SUPABASE} https://yfdglvhhakbuahyfrihs.storage.supabase.co https://${BUCKET}.${ACCOUNT}.r2.cloudflarestorage.com; ` +
        `media-src 'self' blob: ${SUPABASE} https://yfdglvhhakbuahyfrihs.storage.supabase.co https://${BUCKET}.${ACCOUNT}.r2.cloudflarestorage.com; ` +
        "font-src 'self'; " +
        `connect-src 'self' ${SUPABASE} https://yfdglvhhakbuahyfrihs.storage.supabase.co https://${BUCKET}.${ACCOUNT}.r2.cloudflarestorage.com; ` +
        "worker-src 'self' blob:; " +
        "manifest-src 'self'; " +
        "frame-src 'none'; " +
        "child-src 'self' blob:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self' https://checkout.stripe.com https://billing.stripe.com; " +
        "frame-ancestors 'none'; " +
        "report-uri /api/csp-report; " +
        "report-to csp; " +
        "upgrade-insecure-requests",
    );
    expect(buildCsp("NONCE")).not.toMatch(/style-src[^;]*nonce-/);
  });

  it("allows the host the R2 client signs, which a one-label wildcard does not", async () => {
    useEnv({ R2_ACCOUNT_ID: ACCOUNT, R2_BUCKET: BUCKET, NODE_ENV: "production" });
    const config: R2Config = { accountId: ACCOUNT, accessKeyId: "key", secretAccessKey: "secret", bucket: BUCKET };
    const url = await presignR2(r2Client(config), config, "events/x/original.jpg", 60);
    const host = new URL(url).host;
    expect(host).toBe(`${BUCKET}.${ACCOUNT}.r2.cloudflarestorage.com`);
    expect(buildCsp("n")).toContain(`https://${host}`);
    // The SDK default is virtual-hosted. CSP `*.r2.cloudflarestorage.com` matches one label only.
    expect(host.endsWith(".r2.cloudflarestorage.com")).toBe(true);
    expect(host.replace(/\.r2\.cloudflarestorage\.com$/, "").includes(".")).toBe(true);
  });

  it("uses a custom R2 endpoint host when one is configured", async () => {
    const endpoint = "http://127.0.0.1:9000";
    useEnv({ R2_ENDPOINT: endpoint, R2_ACCOUNT_ID: ACCOUNT, R2_BUCKET: BUCKET, NODE_ENV: "production" });
    const config: R2Config = {
      accountId: ACCOUNT,
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: BUCKET,
      endpoint,
    };
    const url = await presignR2(r2Client(config), config, "events/x/original.jpg", 60);
    expect(new URL(url).origin).toBe(endpoint);
    const csp = buildCsp("n");
    expect(csp).toContain(endpoint);
    expect(csp).not.toContain("r2.cloudflarestorage.com");
  });

  it("falls back to the single-label R2 wildcard when R2 is not configured", () => {
    useEnv({ NODE_ENV: "production" });
    expect(buildCsp("n")).toContain("https://*.r2.cloudflarestorage.com");
  });

  it("adds the dev socket and leaves insecure requests alone locally", () => {
    useEnv({ NODE_ENV: "development" });
    const csp = buildCsp("n");
    expect(csp).toContain("connect-src 'self' https://*.r2.cloudflarestorage.com ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("'unsafe-eval'");
  });

  it("allows the Vercel toolbar on preview deployments", () => {
    useEnv({ VERCEL_ENV: "preview", NODE_ENV: "production" });
    const csp = buildCsp("n");
    expect(csp).toContain("script-src 'self' 'nonce-n' 'strict-dynamic' 'report-sample' 'unsafe-eval' https://vercel.live");
    expect(csp).toContain("https://vercel.com");
    expect(csp).toContain("https://assets.vercel.com");
    expect(csp).toContain("wss://ws-us3.pusher.com");
    expect(csp).toContain("frame-src https://vercel.live");
  });

  it("points Reporting-Endpoints at APP_URL", () => {
    useEnv({ APP_URL: "https://events.klubbies.app" });
    expect(reportingEndpoints()).toBe('csp="https://events.klubbies.app/api/csp-report"');
    useEnv({});
    expect(reportingEndpoints()).toBe('csp="/api/csp-report"');
  });
});

describe("permissions policy", () => {
  it("allows the camera only on the selfie page", () => {
    const denied = permissionsPolicy("/pricing");
    const selfie = permissionsPolicy("/e/uq_vb/me");
    expect(denied).toContain("camera=()");
    expect(denied).not.toContain("camera=(self)");
    expect(selfie).toContain("camera=(self)");
    expect(selfie).not.toContain("camera=()");
    expect(permissionsPolicy("/e/uq_vb/me/extra")).toContain("camera=(self)");
    expect(permissionsPolicy("/e/uq_vb/media")).toContain("camera=()");
    expect(permissionsPolicy("/e/uq_vb/meow")).toContain("camera=()");
    expect(denied).toContain("clipboard-write=(self)");
    expect(denied).toContain("web-share=(self)");
    expect(denied).toContain("fullscreen=(self)");
  });
});

describe("csp report endpoint", () => {
  function post(body: string, headers: Record<string, string> = {}) {
    return POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report", "content-length": String(Buffer.byteLength(body)), ...headers },
        body,
      }),
    );
  }

  it("logs a report and drops query strings that carry signed tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://events.klubbies.app/e/demo?src=flyer&token=doc-secret",
        "effective-directive": "img-src",
        "blocked-uri": "https://yfdglvhhakbuahyfrihs.supabase.co/storage/v1/object/sign/event_media/a.jpg?token=super-secret",
        "source-file": "https://bucket.account.r2.cloudflarestorage.com/events/a.jpg?X-Amz-Signature=sig",
        "line-number": 12,
        "script-sample": "alert(1)",
        disposition: "report",
      },
    });
    const res = await post(body);
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(warn.mock.calls[0][1]));
    expect(logged).toEqual({
      doc: "https://events.klubbies.app/e/demo",
      directive: "img-src",
      blocked: "https://yfdglvhhakbuahyfrihs.supabase.co/storage/v1/object/sign/event_media/a.jpg",
      source: "https://bucket.account.r2.cloudflarestorage.com/events/a.jpg",
      line: 12,
      sample: "alert(1)",
      disposition: "report",
    });
    expect(JSON.stringify(logged)).not.toContain("secret");
    expect(JSON.stringify(logged)).not.toContain("X-Amz");
    warn.mockRestore();
  });

  it("accepts a Reporting API batch and keeps the first twenty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reports = Array.from({ length: 25 }, (_, i) => ({
      type: "csp-violation",
      body: { documentURL: `https://events.klubbies.app/p${i}`, effectiveDirective: "script-src", blockedURL: "inline" },
    }));
    const res = await post(JSON.stringify(reports), { "content-type": "application/reports+json" });
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(20);
    warn.mockRestore();
  });

  it("rejects a bad type, a bad body, and anything over 16 KB", async () => {
    expect((await post("x", { "content-type": "text/plain" })).status).toBe(415);
    expect((await post("not-json")).status).toBe(400);
    expect((await post("{}", { "content-length": String(16 * 1024 + 1) })).status).toBe(413);

    const big = "a".repeat(20 * 1024);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const res = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );
    expect(res.status).toBe(413);
  });
});

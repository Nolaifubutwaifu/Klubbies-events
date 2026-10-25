import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { LIMITS } from "@/lib/auth/rate-limit";
import { presignR2, r2Client, type R2Config } from "@/lib/backup/r2-core";
import { buildCsp, permissionsPolicy, reportingEndpoints } from "@/lib/security/csp";

const { hitRateLimit } = vi.hoisted(() => ({
  hitRateLimit: vi.fn(async () => false),
}));

vi.mock("@/lib/auth/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/rate-limit")>("@/lib/auth/rate-limit");
  return { ...actual, hitRateLimit };
});

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
  hitRateLimit.mockReset();
  hitRateLimit.mockResolvedValue(false);
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
        "script-src 'self' 'nonce-NONCE' 'strict-dynamic' 'report-sample'; " +
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
    expect(buildCsp("NONCE")).not.toContain("'unsafe-eval'");
    expect(buildCsp("NONCE")).not.toContain("'wasm-unsafe-eval'");
    expect(buildCsp("NONCE")).toContain("worker-src 'self' blob:");
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
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("'wasm-unsafe-eval'");
  });

  it("allows the Vercel toolbar on preview deployments", () => {
    useEnv({ VERCEL_ENV: "preview", NODE_ENV: "production" });
    const csp = buildCsp("n");
    expect(csp).toContain("script-src 'self' 'nonce-n' 'strict-dynamic' 'report-sample' https://vercel.live");
    expect(csp).not.toContain("'unsafe-eval'");
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

  it("masks guest capability tokens in logged paths and leaves other paths alone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const token = "7hK2-wRq9-mB4t";
    const mediaId = "11111111-1111-4111-8111-111111111111";
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": `https://events.klubbies.app/g/${token}?src=flyer`,
        "blocked-uri": `https://events.klubbies.app/api/guest/${token}/ticket?token=query-secret`,
        "source-file": `https://events.klubbies.app/api/guest/${token}/finalize/${mediaId}#preview`,
        "script-sample": `fetch("/g/${token}#top")`,
        "effective-directive": "connect-src",
      },
    });
    const res = await post(body);
    expect(res.status).toBe(204);
    const logged = JSON.parse(String(warn.mock.calls[0][1]));
    expect(logged.doc).toBe("https://events.klubbies.app/g/[redacted]");
    expect(logged.blocked).toBe("https://events.klubbies.app/api/guest/[redacted]/ticket");
    expect(logged.source).toBe(`https://events.klubbies.app/api/guest/[redacted]/finalize/${mediaId}#preview`);
    expect(logged.sample).toBe('fetch("/g/[redacted]#top")');
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("query-secret");
    expect(serialized).toContain(mediaId);

    warn.mockClear();
    const ordinary = JSON.stringify({
      "csp-report": {
        "document-uri": "https://events.klubbies.app/guides/getting-started",
        "blocked-uri": "https://events.klubbies.app/e/uq_vb/me",
        "source-file": "https://events.klubbies.app/gallery",
      },
    });
    await post(ordinary);
    const plain = JSON.parse(String(warn.mock.calls[0][1]));
    expect(plain.doc).toBe("https://events.klubbies.app/guides/getting-started");
    expect(plain.blocked).toBe("https://events.klubbies.app/e/uq_vb/me");
    expect(plain.source).toBe("https://events.klubbies.app/gallery");
    warn.mockRestore();
  });

  it("masks a guest token that ends on a quote or a space, and strips the sample query", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const token = "7hK2-wRq9-mB4t";
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://events.klubbies.app/pricing",
        "script-sample": `fetch("/g/${token}") /g/${token} rest /api/guest/${token}?token=sample-secret`,
      },
    });
    const res = await post(body);
    expect(res.status).toBe(204);
    const logged = JSON.parse(String(warn.mock.calls[0][1]));
    expect(logged.sample).toBe('fetch("/g/[redacted]") /g/[redacted] rest /api/guest/[redacted]');
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("sample-secret");
    warn.mockRestore();
  });

  it("drops a secret that follows & and redacts token= and sig= with no question mark", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://events.klubbies.app/e/demo&sig=SECRET",
        "blocked-uri": "a&token=OTHER-SECRET",
        "source-file": "https://bucket.example/a.jpg&X-Amz-Signature=amz-secret",
        "script-sample": "use token=sample-secret&ignored=1",
      },
    });
    const res = await post(body);
    expect(res.status).toBe(204);
    const logged = JSON.parse(String(warn.mock.calls[0][1]));
    expect(logged.doc).toBe("https://events.klubbies.app/e/demo");
    expect(logged.blocked).toBe("a");
    expect(logged.source).toBe("https://bucket.example/a.jpg");
    expect(logged.sample).toBe("use token=[redacted]");
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("sample-secret");
    expect(serialized).not.toContain("amz-secret");
    expect(serialized).not.toContain("ignored");
    warn.mockRestore();
  });

  it("coerces the line to a number and the disposition to a short string", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const junk = "z".repeat(400);
    const res = await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://events.klubbies.app/pricing",
          "line-number": { leak: junk },
          disposition: junk,
        },
      }),
    );
    expect(res.status).toBe(204);
    const logged = JSON.parse(String(warn.mock.calls[0][1]));
    expect(logged.line).toBeNull();
    expect(logged.disposition).toBe("z".repeat(32));
    expect(JSON.stringify(logged)).not.toContain(junk);

    warn.mockClear();
    await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://events.klubbies.app/pricing",
          "line-number": "12",
          disposition: "  report  ",
        },
      }),
    );
    const clean = JSON.parse(String(warn.mock.calls[0][1]));
    expect(clean.line).toBe(12);
    expect(clean.disposition).toBe("report");

    warn.mockClear();
    await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://events.klubbies.app/pricing",
          "line-number": "0x10",
        },
      }),
    );
    expect(JSON.parse(String(warn.mock.calls[0][1])).line).toBeNull();

    warn.mockClear();
    await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://events.klubbies.app/pricing",
          "line-number": "1e3",
        },
      }),
    );
    const scientific = JSON.parse(String(warn.mock.calls[0][1]));
    expect(scientific.line).toBeNull();
    expect(JSON.stringify(scientific)).not.toContain("1e3");

    warn.mockClear();
    await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://events.klubbies.app/pricing",
          "line-number": 1000,
        },
      }),
    );
    expect(JSON.parse(String(warn.mock.calls[0][1])).line).toBe(1000);

    warn.mockClear();
    await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://events.klubbies.app/pricing",
          "line-number": "12abc",
          disposition: ["enforce", junk],
        },
      }),
    );
    const rejected = JSON.parse(String(warn.mock.calls[0][1]));
    expect(rejected.line).toBeNull();
    expect(rejected.disposition).toBeNull();
    expect(JSON.stringify(rejected)).not.toContain(junk);
    warn.mockRestore();
  });

  it("answers 204 and logs nothing when the rate-limit check fails", async () => {
    hitRateLimit.mockRejectedValueOnce(new Error("auth_rate_events down\n    at hitRateLimit (/lib/auth/rate-limit.ts:38:11)"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("not-json", { "x-forwarded-for": "203.0.113.9" });
    expect(res.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(hitRateLimit).toHaveBeenCalledWith(LIMITS.cspReportPerIp, "203.0.113.9");
    warn.mockRestore();
    error.mockRestore();
  });

  it("rate limits per IP before reading the body and does not log when limited", async () => {
    hitRateLimit.mockResolvedValueOnce(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post("not-json", { "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(res.status).toBe(429);
    expect(warn).not.toHaveBeenCalled();
    expect(hitRateLimit).toHaveBeenCalledTimes(1);
    expect(hitRateLimit).toHaveBeenCalledWith(LIMITS.cspReportPerIp, "203.0.113.9");
    expect(LIMITS.cspReportPerIp).toEqual({ bucket: "csp_report:ip", limit: 60, windowSeconds: 60 });
    warn.mockRestore();
  });

  it("logs when the IP is under the limit, using x-real-ip if nothing was forwarded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(JSON.stringify({ "csp-report": { "document-uri": "https://events.klubbies.app/" } }), {
      "x-real-ip": "198.51.100.4",
    });
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(hitRateLimit).toHaveBeenCalledWith(LIMITS.cspReportPerIp, "198.51.100.4");
    warn.mockRestore();
  });
});

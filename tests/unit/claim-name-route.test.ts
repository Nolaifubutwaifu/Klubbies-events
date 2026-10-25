import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));
const session = vi.hoisted(() => ({ current: null as { id: string; email: string } | null }));
const limited = vi.hoisted(() => ({ current: false, keys: [] as string[], counts: new Map<string, number>() }));
const claim = vi.hoisted(() => ({
  current: (async () => ({ ok: true as const, redirectTo: "/events" })) as (input: {
    userId: string;
    email: string;
    name: string;
  }) => Promise<{ ok: true; redirectTo: string } | { ok: false; error: string; status: number }>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.current.has(name) ? { name, value: jar.current.get(name) } : undefined),
    set: (name: string, value: string) => jar.current.set(name, value),
    delete: (name: string) => jar.current.delete(name),
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => session.current,
}));

vi.mock("@/lib/auth/request", () => ({
  clientFingerprint: async () => ({ ip: "203.0.113.8", ipHash: "ip", userAgent: "test" }),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  LIMITS: {
    claimNamePerUser: { bucket: "claim_name:user", limit: 10, windowSeconds: 3600 },
    claimNamePerIp: { bucket: "claim_name:ip", limit: 400, windowSeconds: 3600 },
  },
  RATE_LIMITED: "Too many sign-ins from here right now. Wait a minute and try again.",
  hitRateLimit: async (limit: { bucket: string; limit: number }, key: string) => {
    const id = `${limit.bucket}:${key}`;
    limited.keys.push(id);
    if (limited.current) return true;
    const seen = limited.counts.get(id) ?? 0;
    if (seen >= limit.limit) return true;
    limited.counts.set(id, seen + 1);
    return false;
  },
}));

vi.mock("@/lib/auth/flow", () => ({
  claimSignInName: (input: { userId: string; email: string; name: string }) => claim.current(input),
}));

vi.mock("@/lib/env", () => ({
  serverEnv: () => ({ SIGNED_URL_SECRET: "test-secret-test-secret" }),
}));

const { POST } = await import("@/app/api/auth/claim_name/route");
const USER = "11111111-1111-4111-8111-111111111111";

function call(body: string) {
  return POST(new Request("http://localhost/api/auth/claim_name", { method: "POST", body, headers: { "content-type": "application/json" } }));
}

beforeEach(() => {
  jar.current = new Map([["kb_name_step", "forged-cookie"], ["kb_next", "/account"]]);
  session.current = { id: USER, email: "ada@example.com" };
  limited.current = false;
  limited.keys = [];
  limited.counts = new Map();
  claim.current = async () => ({ ok: true, redirectTo: "/events" });
});

describe("POST /api/auth/claim_name", () => {
  it("answers 401 before reading a body when nobody is signed in", async () => {
    session.current = null;
    let read = false;
    const request = new Request("http://localhost/api/auth/claim_name", { method: "POST", body: "{" });
    const response = await POST(
      new Proxy(request, {
        get(target, prop, receiver) {
          if (prop === "json") {
            return async () => {
              read = true;
              return target.json();
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      }),
    );
    expect(read).toBe(false);
    expect(response.status).toBe(401);
    expect(jar.current.has("kb_name_step")).toBe(false);
  });

  it("rate limits per user and per IP and still drops the cookie", async () => {
    limited.current = true;
    const response = await call(JSON.stringify({ name: "Ada Lovelace" }));
    expect(response.status).toBe(429);
    expect(jar.current.has("kb_name_step")).toBe(false);
  });

  it("does not let a forged cookie choose the event", async () => {
    let received: unknown = null;
    claim.current = async (input) => {
      received = input;
      return { ok: true, redirectTo: "/e/summit" };
    };
    jar.current.set("kb_name_step", JSON.stringify({ flow: "join", eventId: "33333333-3333-4333-8333-333333333333" }));
    const response = await call(JSON.stringify({ name: "Ada Lovelace" }));
    expect(limited.keys).toEqual([`claim_name:user:${USER}`, "claim_name:ip:203.0.113.8"]);
    expect(response.status).toBe(200);
    expect(received).toEqual({ userId: USER, email: "ada@example.com", name: "Ada Lovelace" });
    expect(jar.current.has("kb_name_step")).toBe(false);
    await expect(response.json()).resolves.toMatchObject({ redirectTo: "/account" });
  });

  it("returns to the photo that was open before the name step", async () => {
    const photo = "/e/abc/a/123?photo=9";
    jar.current.set("kb_next", photo);
    const response = await call(JSON.stringify({ name: "Ada Lovelace" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, redirectTo: photo });
    expect(jar.current.has("kb_next")).toBe(false);
  });

  it("sends an already-named account to the return path", async () => {
    claim.current = async () => ({ ok: false, status: 409, error: "This account already has a name." });
    jar.current.set("kb_next", "/e/summit");
    const response = await call(JSON.stringify({ name: "Ada Lovelace" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ redirectTo: "/e/summit" });
    expect(jar.current.has("kb_next")).toBe(false);
    expect(jar.current.has("kb_named")).toBe(true);
    expect(jar.current.has("kb_name_step")).toBe(false);
  });

  it("returns 429 on the 11th claim in an hour", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await call(JSON.stringify({ name: "Ada Lovelace" }))).status);
    expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 200));
    expect(statuses[10]).toBe(429);
  });

  it("returns the claim status for an expired step", async () => {
    claim.current = async () => ({ ok: false, status: 401, error: "Your sign in timed out. Start again." });
    const response = await call(JSON.stringify({ name: "Ada Lovelace" }));
    expect(response.status).toBe(401);
    expect(jar.current.has("kb_name_step")).toBe(false);
  });
});

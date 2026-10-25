import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));
const session = vi.hoisted(() => ({ current: null as { id: string; email: string } | null }));
const limited = vi.hoisted(() => ({ current: false, keys: [] as string[] }));
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
  hitRateLimit: async (limit: { bucket: string }, key: string) => {
    limited.keys.push(`${limit.bucket}:${key}`);
    return limited.current;
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

  it("returns the claim status for an expired step", async () => {
    claim.current = async () => ({ ok: false, status: 401, error: "Your sign in timed out. Start again." });
    const response = await call(JSON.stringify({ name: "Ada Lovelace" }));
    expect(response.status).toBe(401);
    expect(jar.current.has("kb_name_step")).toBe(false);
  });
});

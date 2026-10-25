import { describe, expect, it } from "vitest";
import {
  NAME_STEP_TTL_MS,
  appPathNeedsName,
  codeRequestFieldError,
  decodeNameStep,
  encodeNameStep,
  encodeNamedCookie,
  knownSignInName,
  namedCookieMatches,
  requestCodeSchema,
  rosterNameForLinkJoin,
} from "@/lib/auth/sign-in-name";

const SECRET = "test-secret-test-secret";
const USER = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

function step(overrides: Partial<{ userId: string; flow: "member" | "join" | "create" | "signup"; eventId: string | null; exp: number }> = {}) {
  return {
    userId: USER,
    flow: "join" as const,
    eventId: EVENT,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

describe("requestCodeSchema", () => {
  it("accepts an email on its own for sign-in", () => {
    const parsed = requestCodeSchema.safeParse({ email: "  Mara@Uni.edu " });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.email).toBe("Mara@Uni.edu");
    expect(parsed.data.fullName).toBeUndefined();
    expect(parsed.data.flow).toBe("member");
    expect(codeRequestFieldError(parsed.data)).toBeNull();
  });

  it("treats a blank name as not given", () => {
    const parsed = requestCodeSchema.safeParse({ email: "mara@uni.edu", fullName: "   ", flow: "join" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.fullName).toBeUndefined();
    expect(codeRequestFieldError(parsed.data)).toBeNull();
  });

  it("keeps a name when one was typed", () => {
    const parsed = requestCodeSchema.parse({ email: "mara@uni.edu", fullName: "  Mara Lindqvist  " });
    expect(parsed.fullName).toBe("Mara Lindqvist");
  });

  it("still requires a name to create an event", () => {
    const parsed = requestCodeSchema.parse({ email: "org@uni.edu", flow: "create" });
    expect(codeRequestFieldError(parsed)).toBe("Enter your full name");
    expect(codeRequestFieldError({ ...parsed, fullName: "Ada Lovelace" })).toBeNull();
  });

  it("rejects a missing email", () => {
    expect(requestCodeSchema.safeParse({ fullName: "Ada" }).success).toBe(false);
  });
});

describe("knownSignInName", () => {
  it("prefers the name typed for this request, then the saved account name", () => {
    expect(knownSignInName("Ada Lovelace", "Ada")).toBe("Ada Lovelace");
    expect(knownSignInName("  ", "Ada")).toBe("Ada");
    expect(knownSignInName(null, "  ")).toBe("");
    expect(knownSignInName(null, null)).toBe("");
  });
});

describe("name step cookie", () => {
  it("round-trips a signed step and ignores a forged one", () => {
    const value = encodeNameStep(step(), SECRET);
    expect(decodeNameStep(value, SECRET)).toMatchObject({ userId: USER, flow: "join", eventId: EVENT });
    expect(decodeNameStep(value, "other-secret-other-secret")).toBeNull();

    const [payload, sig] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: USER, flow: "join", eventId: OTHER, exp: step().exp })).toString("base64url");
    expect(decodeNameStep(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(decodeNameStep(`${payload}.not-the-signature`, SECRET)).toBeNull();
    expect(decodeNameStep(JSON.stringify({ flow: "join", eventId: EVENT }), SECRET)).toBeNull();
    expect(decodeNameStep(null, SECRET)).toBeNull();
  });

  it("rejects an expired signature", () => {
    const value = encodeNameStep(step({ exp: Math.floor(Date.now() / 1000) - 10 }), SECRET);
    expect(decodeNameStep(value, SECRET)).toBeNull();
  });

  it("waits longer than fifteen minutes for the name", () => {
    expect(NAME_STEP_TTL_MS).toBeGreaterThan(15 * 60 * 1000);
  });
});

describe("named cookie", () => {
  it("matches only this user, until it expires", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const value = encodeNamedCookie(USER, exp, SECRET);
    expect(namedCookieMatches(value, USER, SECRET)).toBe(true);
    expect(namedCookieMatches(value, OTHER, SECRET)).toBe(false);
    expect(namedCookieMatches(`${USER}.${exp}.forged`, USER, SECRET)).toBe(false);
    expect(namedCookieMatches(encodeNamedCookie(USER, Math.floor(Date.now() / 1000) - 5, SECRET), USER, SECRET)).toBe(false);
  });
});

describe("rosterNameForLinkJoin", () => {
  it("uses the typed name and never invents one", () => {
    expect(rosterNameForLinkJoin("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(rosterNameForLinkJoin(null)).toBeNull();
    expect(rosterNameForLinkJoin("   ")).toBeNull();
  });
});

describe("appPathNeedsName", () => {
  it("sends product pages through the name step and leaves the step itself alone", () => {
    expect(appPathNeedsName("/events")).toBe(true);
    expect(appPathNeedsName("/e/summit")).toBe(true);
    expect(appPathNeedsName("/e/summit/a/album")).toBe(true);
    expect(appPathNeedsName("/account")).toBe(true);
    expect(appPathNeedsName("/admin/new")).toBe(true);
    expect(appPathNeedsName("/signin/name")).toBe(false);
    expect(appPathNeedsName("/signin")).toBe(false);
    expect(appPathNeedsName("/start")).toBe(false);
    expect(appPathNeedsName("/api/auth/claim_name")).toBe(false);
    expect(appPathNeedsName("/faq")).toBe(false);
  });
});

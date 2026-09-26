import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bandFor, SIMILARITY } from "@/lib/faces/constants";

describe("similarity bands", () => {
  it("confirms at the threshold and above", () => {
    expect(bandFor(SIMILARITY.confirmed)).toBe("confirmed");
    expect(bandFor(99.9)).toBe("confirmed");
  });

  it("suggests between the two thresholds", () => {
    expect(bandFor(SIMILARITY.suggested)).toBe("suggested");
    expect(bandFor(SIMILARITY.confirmed - 0.1)).toBe("suggested");
  });

  it("writes nothing below the suggested threshold", () => {
    expect(bandFor(SIMILARITY.suggested - 0.1)).toBeNull();
    expect(bandFor(0)).toBeNull();
  });

  it("leaves no gap between the bands", () => {
    expect(SIMILARITY.suggested).toBeLessThan(SIMILARITY.confirmed);
  });
});

// The gate for step 4 of the build: a machine with no AWS credentials must
// boot and no-op, never throw. Getting this wrong takes down every upload,
// because the finalize route asks whether faces are configured.
describe("client configuration", () => {
  const AWS_KEYS = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const key of AWS_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    // serverEnv() parses the whole schema, so the unrelated required vars
    // have to be present for this test to be about AWS at all.
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service";
    process.env.RESEND_API_KEY ??= "resend";
    process.env.APP_URL ??= "http://localhost:3000";
    process.env.SIGNED_URL_SECRET ??= "0123456789abcdef";
    process.env.CRON_SECRET ??= "0123456789abcdef";
  });

  afterEach(() => {
    for (const key of AWS_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("reports itself unconfigured rather than throwing", async () => {
    const { faceClient, facesConfigured } = await import("@/lib/faces/client");
    expect(() => faceClient()).not.toThrow();
    expect(faceClient()).toBeNull();
    expect(facesConfigured()).toBe(false);
  });

  it("builds a client once both keys are set", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    const { faceClient, facesConfigured } = await import("@/lib/faces/client");
    expect(facesConfigured()).toBe(true);
    expect(faceClient()).not.toBeNull();
  });

  it("namespaces collections per club, and per environment", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.REKOGNITION_COLLECTION_PREFIX = "klubbies-test";
    const { collectionIdFor } = await import("@/lib/faces/client");
    expect(collectionIdFor("8f3c1111-2222-3333-4444-555566667777")).toBe(
      "klubbies-test-club-8f3c1111-2222-3333-4444-555566667777",
    );
  });
});

describe("external image ids", () => {
  it("round-trips both kinds", async () => {
    const { mediaExternalId, parseExternalId, referenceExternalId } = await import("@/lib/faces/client");
    expect(parseExternalId(mediaExternalId("abc"))).toEqual({ kind: "media", id: "abc" });
    expect(parseExternalId(referenceExternalId("def"))).toEqual({ kind: "ref", id: "def" });
  });

  it("refuses anything it did not write", async () => {
    const { parseExternalId } = await import("@/lib/faces/client");
    expect(parseExternalId(undefined)).toBeNull();
    expect(parseExternalId("no-colon")).toBeNull();
    expect(parseExternalId("other:abc")).toBeNull();
  });

  it("keeps a uuid intact, colons and all", async () => {
    const { parseExternalId } = await import("@/lib/faces/client");
    const uuid = "8f3c1111-2222-3333-4444-555566667777";
    expect(parseExternalId(`ref:${uuid}`)).toEqual({ kind: "ref", id: uuid });
  });
});

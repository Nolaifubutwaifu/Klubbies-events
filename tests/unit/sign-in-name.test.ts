import { describe, expect, it } from "vitest";
import {
  codeRequestFieldError,
  decodeNameStep,
  encodeNameStep,
  knownSignInName,
  requestCodeSchema,
} from "@/lib/auth/sign-in-name";

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
  const eventId = "11111111-1111-4111-8111-111111111111";

  it("round-trips the flow and event", () => {
    expect(decodeNameStep(encodeNameStep({ flow: "join", eventId }))).toEqual({ flow: "join", eventId });
    expect(decodeNameStep(encodeNameStep({ flow: "member", eventId: null }))).toEqual({ flow: "member", eventId: null });
  });

  it("drops anything that isn't a flow we issued", () => {
    expect(decodeNameStep(null)).toBeNull();
    expect(decodeNameStep("{")).toBeNull();
    expect(decodeNameStep(JSON.stringify({ flow: "nope", eventId: null }))).toBeNull();
    expect(decodeNameStep(JSON.stringify({ flow: "join", eventId: "not-a-uuid" }))).toBeNull();
  });
});

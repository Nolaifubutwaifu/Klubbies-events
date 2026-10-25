import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

describe("safeNextPath", () => {
  it.each([
    ["a tab", "/\t/evil.com"],
    ["a carriage return", "/\r/evil.com"],
    ["a line feed", "/\n/evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["a backslash after the slash", "/\\evil.com"],
    ["a leading backslash", "\\evil.com"],
    ["two leading backslashes", "\\\\evil.com"],
    ["an encoded double slash", "/%2f%2fevil.com"],
    ["an encoded backslash", "/%5cevil.com"],
    ["a double-encoded slash", "/%252f%252fevil.com"],
    ["a double-encoded slash with uppercase hex", "/%252F%252Fevil.com"],
    ["a double-encoded backslash", "/%255cevil.com"],
    ["a javascript URL", "javascript:alert(1)"],
    ["an https URL", "https://evil.com"],
    ["a scheme-relative http URL", "http:evil.com"],
    ["a userinfo path", "/@evil.com"],
    ["an encoded userinfo path", "/%40evil.com"],
    ["a double-encoded userinfo path", "/%2540evil.com"],
    ["a protocol-relative userinfo URL", "//@evil.com"],
    ["a triple slash", "///evil.com"],
    ["an encoded tab", "/%09/evil.com"],
    ["a double-encoded tab", "/%2509/evil.com"],
    ["a dot-segment that normalises to a protocol-relative path", "/.//evil.com"],
    ["an event path that normalises to a protocol-relative path", "/e/..//evil.com"],
  ])("rejects %s", (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it.each(["/events", "/e/abc/me?x=1#y", "/admin/new", "/e/abc?q=a%2Fb"] as const)("allows %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it("returns the parsed pathname, search and hash", () => {
    expect(safeNextPath("/events/./mine?x=1#y")).toBe("/events/mine?x=1#y");
  });

  it.each([
    "/signin",
    "/signin/code",
    "/signin/name",
    "/signin?x=1",
    "/signin#x",
    "/SIGNIN",
    "/signin%23x",
    "/%73ignin",
    "/start",
    "/start/club",
    "/api/auth",
    "/api/auth/verify_code",
  ] as const)("does not point back into %s", (path) => {
    expect(safeNextPath(path)).toBeNull();
  });

  it("refuses empty, missing and over-long values", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(`/${"a".repeat(512)}`)).toBeNull();
  });

  it("is stable when applied twice", () => {
    expect(safeNextPath(safeNextPath("/e/abc/me?x=1#y"))).toBe("/e/abc/me?x=1#y");
  });
});

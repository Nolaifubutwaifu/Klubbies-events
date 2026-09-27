import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isDeadToken, providerToken } from "@/lib/push/apns";

describe("APNs provider token", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("is an ES256 JWT with the key id and team id Apple expects", () => {
    const jwt = providerToken("KEY1234567", "TEAM123456", pem, Date.UTC(2026, 8, 27));
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({ iss: "TEAM123456", iat: Date.UTC(2026, 8, 27) / 1000 });
    const valid = verify("sha256", Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
    expect(valid).toBe(true);
  });

  it("accepts a key pasted with escaped newlines, as some dashboards store it", () => {
    const escaped = pem.replace(/\n/g, "\\n");
    expect(() => providerToken("KEY1234567", "TEAM123456", escaped)).not.toThrow();
  });

  it("forgets tokens Apple says are dead, and only those", () => {
    expect(isDeadToken({ token: "a", ok: false, status: 410, reason: "Unregistered" })).toBe(true);
    expect(isDeadToken({ token: "a", ok: false, status: 400, reason: "BadDeviceToken" })).toBe(true);
    expect(isDeadToken({ token: "a", ok: false, status: 429, reason: "TooManyRequests" })).toBe(false);
    expect(isDeadToken({ token: "a", ok: false, status: 0, reason: "timeout" })).toBe(false);
  });
});

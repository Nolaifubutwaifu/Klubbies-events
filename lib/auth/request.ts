import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";

export function hmac(value: string): string {
  return createHmac("sha256", serverEnv().SIGNED_URL_SECRET).update(value).digest("hex");
}

export async function clientFingerprint(): Promise<{ ip: string; ipHash: string; userAgent: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  return { ip, ipHash: hmac(`ip:${ip}`), userAgent: (h.get("user-agent") ?? "").slice(0, 300) };
}

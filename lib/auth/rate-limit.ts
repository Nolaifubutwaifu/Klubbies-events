import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hmac } from "./request";

// Per address limits are the real defence. Per IP limits are only a flood
// guard: a venue's guests all share one public IP, so they sit well above the
// number of people who'd sign in from one network in an hour.
export const LIMITS = {
  codeRequestPerEmail: { bucket: "request_code:email", limit: 5, windowSeconds: 3600 },
  codeRequestPerIp: { bucket: "request_code:ip", limit: 400, windowSeconds: 3600 },
  verifyPerIp: { bucket: "verify_code:ip", limit: 1200, windowSeconds: 3600 },
  passwordPerEmail: { bucket: "password:email", limit: 10, windowSeconds: 3600 },
  contactPerIp: { bucket: "contact:ip", limit: 5, windowSeconds: 3600 },
  contactPerEmail: { bucket: "contact:email", limit: 5, windowSeconds: 3600 },
} as const;

type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/**
 * Reports whether the caller is already over the limit, and records the hit
 * only when it isn't, so refused retries don't keep the bucket full.
 */
export async function hitRateLimit(limit: Limit, key: string): Promise<boolean> {
  const admin = createAdminClient();
  const keyHash = hmac(`${limit.bucket}:${key}`);
  const since = new Date(Date.now() - limit.windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("auth_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", limit.bucket)
    .eq("key_hash", keyHash)
    .gte("occurred_at", since);
  if (error) throw error;

  if ((count ?? 0) >= limit.limit) return true;
  await admin.from("auth_rate_events").insert({ bucket: limit.bucket, key_hash: keyHash });
  return false;
}

export async function pruneRateEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await createAdminClient().from("auth_rate_events").delete().lt("occurred_at", cutoff);
}

export const RATE_LIMITED = "Too many sign-ins from here right now. Wait a minute and try again.";

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hmac } from "./request";

export const LIMITS = {
  codeRequestPerEmail: { bucket: "request_code:email", limit: 5, windowSeconds: 3600 },
  codeRequestPerIp: { bucket: "request_code:ip", limit: 20, windowSeconds: 3600 },
  verifyPerIp: { bucket: "verify_code:ip", limit: 60, windowSeconds: 3600 },
} as const;

type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/** Records a hit and reports whether the caller was already over the limit. */
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

  await admin.from("auth_rate_events").insert({ bucket: limit.bucket, key_hash: keyHash });
  return (count ?? 0) >= limit.limit;
}

export async function pruneRateEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  await createAdminClient().from("auth_rate_events").delete().lt("occurred_at", cutoff);
}

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { serverEnv } from "@/lib/env";

let admin: SupabaseClient<Database> | undefined;

/**
 * Service-role client. Bypasses RLS, so only use it after authorisation has
 * been established some other way (roster lookup, cron, audit inserts).
 */
export function createAdminClient(): SupabaseClient<Database> {
  const env = serverEnv();
  admin ??= createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

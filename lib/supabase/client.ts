import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { SESSION_COOKIE_OPTIONS, supabaseAnonKey, supabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
  });
}

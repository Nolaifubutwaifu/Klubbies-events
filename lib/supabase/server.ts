import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";
import { SESSION_COOKIE_OPTIONS, supabaseAnonKey, supabaseUrl } from "./config";

/** Request-scoped client acting as the signed-in user. RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component; proxy.ts keeps the session fresh.
        }
      },
    },
  });
}

export type UserClient = Awaited<ReturnType<typeof createClient>>;

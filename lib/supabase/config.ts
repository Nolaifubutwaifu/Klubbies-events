// Public Supabase settings. Referenced literally so Next inlines them into
// client bundles.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Sessions last 30 days and roll forward whenever the proxy refreshes them.
export const SESSION_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_COOKIE, SOURCE_TAG } from "@/lib/attribution";
import { SESSION_COOKIE_OPTIONS, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

const PROTECTED = /^\/(c|admin|events|account|ops)(\/|$)/;

// Refreshes the Supabase session cookie on every navigation and does an
// optimistic redirect for signed-out visitors. Real authorisation happens in
// pages, route handlers and RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;

  if (!data?.claims && PROTECTED.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    const event = pathname.match(/^\/e\/([^/]+)/);
    if (event) url.searchParams.set("event", event[1]);
    return rememberSource(request, NextResponse.redirect(url));
  }

  return rememberSource(request, response);
}

/**
 * A tracked link (?src=flyer-uq-union, the credit line's ?src=credit) is
 * remembered for 30 days in this browser and saved on the next event created
 * from it (pricing handoff §5.9). The first tag wins. It only ever describes
 * the organiser who follows it: guests' visits aren't recorded anywhere.
 */
function rememberSource(request: NextRequest, response: NextResponse): NextResponse {
  const tag = request.nextUrl.searchParams.get("src")?.toLowerCase();
  if (!tag || request.cookies.has(SOURCE_COOKIE) || !SOURCE_TAG.test(tag)) return response;
  response.cookies.set(SOURCE_COOKIE, tag, { maxAge: 30 * 24 * 3600, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/cron|api/stripe|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

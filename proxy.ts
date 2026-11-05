import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_COOKIE, SOURCE_TAG } from "@/lib/attribution";
import { NEXT_COOKIE, NEXT_COOKIE_MAX_AGE, safeNextPath } from "@/lib/auth/next-path";
import {
  NAME_STEP_PATH,
  NAMED_COOKIE,
  NAMED_COOKIE_TTL_MS,
  appPathNeedsName,
  encodeNamedCookie,
  hasDisplayName,
  namedCookieMatches,
  returnPathForNameGate,
} from "@/lib/auth/sign-in-name";
import { serverEnv } from "@/lib/env";
import { buildCsp, permissionsPolicy, reportingEndpoints } from "@/lib/security/csp";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_OPTIONS, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

const PROTECTED = /^\/(c|admin|events|account|ops)(\/|$)/;
// Downloads opened straight from an email: a signed-out click should sign in
// and come back, not show raw JSON.
const DOWNLOADS = /^\/api\/(albums\/[^/]+\/zip|events\/[^/]+\/me\/zip)$/;
// Deeper event pages (an album, a photo) that the event layout sends to
// sign-in; remembered so the visitor lands back on them.
const EVENT_DEEP = /^\/e\/[^/]+\/.+/;

// Phase 1 reports only. Phase 2: "Content-Security-Policy".
const CSP_HEADER = "Content-Security-Policy-Report-Only";

function secure(response: NextResponse, csp: string, pathname: string): NextResponse {
  response.headers.set(CSP_HEADER, csp);
  response.headers.set("Reporting-Endpoints", reportingEndpoints());
  response.headers.set("Permissions-Policy", permissionsPolicy(pathname));
  return response;
}

function remember(response: NextResponse, path: string | null): NextResponse {
  const safe = safeNextPath(path);
  if (safe) {
    response.cookies.set(NEXT_COOKIE, safe, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: NEXT_COOKIE_MAX_AGE,
    });
  }
  return response;
}

// Refreshes the Supabase session cookie on every navigation and does an
// optimistic redirect for signed-out visitors. Real authorisation happens in
// pages, route handlers and RLS. Also attaches the per-request CSP nonce.
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce from Content-Security-Policy, then from this
  // Report-Only header (app-render parseRequestHeaders).
  requestHeaders.set(CSP_HEADER, csp);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  let response = next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        // next() copies requestHeaders, not the mutated request, so the
        // refreshed session has to be on that header or this render misses it.
        requestHeaders.set("cookie", request.cookies.toString());
        response = next();
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;

  const here = `${pathname}${request.nextUrl.search}`;
  const navigating = request.headers.get("sec-fetch-mode") === "navigate" || (request.headers.get("accept") ?? "").includes("text/html");

  if (!data?.claims && (PROTECTED.test(pathname) || (navigating && DOWNLOADS.test(pathname)))) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    return secure(rememberSource(request, remember(NextResponse.redirect(url), here)), csp, pathname);
  }
  if (!data?.claims && navigating && EVENT_DEEP.test(pathname)) remember(response, here);
  // requireUser() sends people to /signin?next=…, and a nameless account sent
  // to the name step can carry the same return path on the query string.
  if (pathname === "/signin" || pathname === NAME_STEP_PATH) remember(response, request.nextUrl.searchParams.get("next"));

  // A verified account with no name has a session and has not been checked
  // against the guest list yet. Send them to finish that before the app.
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (userId && appPathNeedsName(pathname)) {
    const secret = serverEnv().SIGNED_URL_SECRET;
    const alreadyNamed = namedCookieMatches(request.cookies.get(NAMED_COOKIE)?.value, userId, secret);
    if (!alreadyNamed) {
      const { data: profile, error } = await createAdminClient().from("users").select("display_name").eq("id", userId).maybeSingle();
      if (!error && hasDisplayName(profile?.display_name)) {
        const exp = Math.floor((Date.now() + NAMED_COOKIE_TTL_MS) / 1000);
        response.cookies.set(NAMED_COOKIE, encodeNamedCookie(userId, exp, secret), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: Math.floor(NAMED_COOKIE_TTL_MS / 1000),
        });
      } else if (!error) {
        const url = request.nextUrl.clone();
        url.pathname = NAME_STEP_PATH;
        url.search = "";
        const redirect = NextResponse.redirect(url, 303);
        // This redirect is a new response. The session cookies refreshed onto
        // `response` would otherwise be dropped.
        for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
        const existing = request.cookies.get(NEXT_COOKIE)?.value;
        const next = returnPathForNameGate(existing, here);
        // Keep a return path that is already valid. Replacing it with this
        // gated page would send a new account to /events instead of the
        // album or photo they were opening.
        if (next && next !== safeNextPath(existing)) remember(redirect, next);
        return secure(rememberSource(request, redirect), csp, pathname);
      } else {
        // The name gate deliberately fails open on a DB error.
      }
    }
  }

  return secure(rememberSource(request, response), csp, pathname);
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
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/cron|api/stripe|api/csp-report|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

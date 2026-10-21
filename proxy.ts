import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SOURCE_COOKIE, SOURCE_TAG } from "@/lib/attribution";
import { NEXT_COOKIE, NEXT_COOKIE_MAX_AGE, safeNextPath } from "@/lib/auth/next-path";
import { buildCsp, permissionsPolicy, reportingEndpoints } from "@/lib/security/csp";
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
  // requireUser() sends people to /signin?next=…
  if (pathname === "/signin") remember(response, request.nextUrl.searchParams.get("next"));

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

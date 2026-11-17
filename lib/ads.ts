/**
 * Google Ads measurement. Everything here is inert until
 * NEXT_PUBLIC_GOOGLE_ADS_ID is a real tag id: no script, no cookie, no
 * conversion. Guest galleries, join doors and share links are never in scope.
 *
 * Sign-up and event creation are separate steps. /start confirms a new
 * organiser with an email code (flow "create"), then /admin/new creates the
 * event. The unused "signup" flow value is not that step.
 */

import { safeNextPath } from "@/lib/auth/next-path";

/** AW- and the digits Google issues (usually 10). Anything else is ignored. */
const ADS_ID_RE = /^AW-\d{9,11}$/;
/** The label after the slash in AW-1234567890/AbC-dEf. */
const ADS_LABEL_RE = /^[A-Za-z0-9_-]{1,40}$/;
const CLICK_RE = /^[A-Za-z0-9_-]{1,200}$/;
const UTM_RE = /^[A-Za-z0-9 ._+~-]{1,80}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Click ids and campaign fields we keep from the landing URL. */
export const ADS_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type AdsParam = (typeof ADS_PARAMS)[number];
export type AdsAttribution = Partial<Record<AdsParam, string>>;

const CLICK_PARAMS = new Set<AdsParam>(["gclid", "gbraid", "wbraid"]);

/** First-party copy of the landing params. Readable by the tag script. */
export const ADS_COOKIE = "kb_ads";
/** Set for one page view after the server has saved a new event. */
export const ADS_EVENT_COOKIE = "kb_ads_event";
/** Set for one page view after a new organiser account is confirmed. */
export const ADS_SIGNUP_COOKIE = "kb_ads_signup";
/** Request header carrying the validated attribution into the render. */
export const ADS_HEADER = "x-kb-ads";
/** sessionStorage key. Same JSON shape as the decoded cookie. */
export const ADS_STORAGE_KEY = "kb_ads";

export const ADS_ATTR_MAX_AGE = 90 * 24 * 60 * 60;
export const ADS_CONVERSION_MAX_AGE = 10 * 60;

/**
 * A new auth user and the pending sign-in row are written in the same code
 * request. Longer than that and this is a later sign-in, not a new account.
 */
const NEW_ACCOUNT_WINDOW_MS = 2 * 60 * 1000;

/**
 * Guest and shared surfaces. Marketing URLs have no prefix, so this list is
 * the boundary: /e is the gallery (home, album, photo, selfie), /g is a
 * photographer share link, /signin is the join door and the member sign-in,
 * /events and /account are used by guests as well as organisers.
 */
const BLOCKED_SURFACES = [
  /^\/e(\/|$)/,
  /^\/g(\/|$)/,
  /^\/signin(\/|$)/,
  /^\/events(\/|$)/,
  /^\/account(\/|$)/,
  /^\/ops(\/|$)/,
  /^\/api(\/|$)/,
];

export function googleAdsId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
  return ADS_ID_RE.test(raw) ? raw : null;
}

function label(name: "NEXT_PUBLIC_GOOGLE_ADS_EVENT_CREATED_LABEL" | "NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL"): string | null {
  if (!googleAdsId()) return null;
  const raw = process.env[name]?.trim() ?? "";
  return ADS_LABEL_RE.test(raw) ? raw : null;
}

export function googleAdsEventLabel(): string | null {
  return label("NEXT_PUBLIC_GOOGLE_ADS_EVENT_CREATED_LABEL");
}

export function googleAdsSignupLabel(): string | null {
  return label("NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL");
}

export function googleAdsScriptSrc(id: string): string | null {
  if (!ADS_ID_RE.test(id)) return null;
  return `https://www.googletagmanager.com/gtag/js?id=${id}`;
}

export function isAdsUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * True for marketing pages and organiser tools (/admin, /start).
 * False for galleries, doors, share links and pages guests share with organisers.
 */
export function loadsGoogleAds(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
  if (BLOCKED_SURFACES.some((pattern) => pattern.test(path))) return false;
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  if (path === "/start" || path.startsWith("/start/")) return true;
  // Public pages: /, /pricing, /guides/some-slug, /account-deleted.
  if (path.includes(".")) return false;
  return /^\/(?:[a-z0-9][a-z0-9-]*)?(?:\/[a-z0-9][a-z0-9-]*)*$/.test(path);
}

function cleanParam(key: AdsParam, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return (CLICK_PARAMS.has(key) ? CLICK_RE : UTM_RE).test(trimmed) ? trimmed : null;
}

export function attributionFromParams(params: URLSearchParams): AdsAttribution | null {
  const out: AdsAttribution = {};
  for (const key of ADS_PARAMS) {
    const raw = params.get(key);
    if (raw === null) continue;
    const cleaned = cleanParam(key, raw);
    if (cleaned) out[key] = cleaned;
  }
  return Object.keys(out).length ? out : null;
}

export function encodeAttribution(value: AdsAttribution | null): string | null {
  if (!value) return null;
  const params = new URLSearchParams();
  for (const key of ADS_PARAMS) {
    const item = value[key];
    if (item) params.set(key, item);
  }
  const cleaned = attributionFromParams(params);
  if (!cleaned) return null;
  const encoded = Buffer.from(JSON.stringify(cleaned), "utf8").toString("base64url");
  if (encoded.length > 700) return null;
  return encoded;
}

export function decodeAttribution(encoded: string | null | undefined): AdsAttribution | null {
  if (!encoded || encoded.length > 700 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const params = new URLSearchParams();
  for (const key of ADS_PARAMS) {
    const item = (parsed as Record<string, unknown>)[key];
    if (typeof item === "string") params.set(key, item);
  }
  return attributionFromParams(params);
}

/**
 * What this request should expose to the page, and whether the response
 * should store a new cookie. An existing valid cookie wins (first landing).
 * Returns nothing on guest routes and when the tag id is unset.
 */
export function adsForRequest(input: {
  pathname: string;
  searchParams: URLSearchParams;
  cookie: string | undefined;
}): { header: string | null; setCookie: string | null } {
  if (!googleAdsId() || !loadsGoogleAds(input.pathname)) return { header: null, setCookie: null };
  const existing = decodeAttribution(input.cookie);
  if (existing) return { header: encodeAttribution(existing), setCookie: null };
  const fresh = encodeAttribution(attributionFromParams(input.searchParams));
  if (!fresh) return { header: null, setCookie: null };
  return { header: fresh, setCookie: fresh };
}

export function adsCookieOptions(maxAge: number): {
  path: string;
  maxAge: number;
  sameSite: "lax";
  secure: boolean;
  httpOnly: false;
} {
  return {
    path: "/",
    maxAge,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // The tag script reads the conversion cookies. The values are an event
    // id or a user id, already known to that browser's session.
    httpOnly: false,
  };
}

/**
 * Adds the stored click ids to an internal redirect, and only when that
 * redirect stays on an ads surface. safeNextPath runs before and after, so
 * a crafted value cannot turn this into an off-site URL.
 */
export function decorateAdsRedirect(path: string, encoded: string | undefined): string {
  const safe = safeNextPath(path);
  if (!safe) return "/events";
  if (!googleAdsId()) return safe;
  const attribution = decodeAttribution(encoded);
  if (!attribution) return safe;

  let url: URL;
  try {
    url = new URL(safe, "https://x.invalid");
  } catch {
    return safe;
  }
  if (url.origin !== "https://x.invalid" || !loadsGoogleAds(url.pathname)) return safe;

  let changed = false;
  for (const key of ADS_PARAMS) {
    const value = attribution[key];
    if (!value || url.searchParams.has(key)) continue;
    url.searchParams.set(key, value);
    changed = true;
  }
  if (!changed) return safe;
  const next = `${url.pathname}${url.search}${url.hash}`;
  return safeNextPath(next) ?? safe;
}

/**
 * True only for the organiser create flow, and only when this auth user was
 * created with the code that is being verified. A later sign-in, a guest
 * join, and an organiser who already has an event do not qualify.
 */
export function isNewOrganiserSignup(input: {
  flow: string;
  userCreatedAt: string | null | undefined;
  pendingCreatedAt: string | null | undefined;
  membershipCount: number;
}): boolean {
  if (input.flow !== "create") return false;
  if (input.membershipCount > 0) return false;
  if (!input.userCreatedAt || !input.pendingCreatedAt) return false;
  const userMs = Date.parse(input.userCreatedAt);
  const pendingMs = Date.parse(input.pendingCreatedAt);
  if (!Number.isFinite(userMs) || !Number.isFinite(pendingMs)) return false;
  const delta = pendingMs - userMs;
  return delta >= -5_000 && delta <= NEW_ACCOUNT_WINDOW_MS;
}

export type GoogleAdsBootstrap = {
  id: string;
  attribution: AdsAttribution | null;
  eventLabel: string | null;
  signupLabel: string | null;
};

/**
 * Inline gtag setup. Queues config, restores click ids onto page_location
 * when the URL no longer has them, and fires at most one conversion per
 * cookie. The external gtag.js file is a separate script tag.
 */
export function googleAdsBootstrap(input: GoogleAdsBootstrap): string | null {
  if (!ADS_ID_RE.test(input.id)) return null;
  if (input.eventLabel && !ADS_LABEL_RE.test(input.eventLabel)) return null;
  if (input.signupLabel && !ADS_LABEL_RE.test(input.signupLabel)) return null;
  const attribution = input.attribution ? attributionFromParams(toParams(input.attribution)) : null;
  const cfg = JSON.stringify({
    id: input.id,
    attribution,
    eventLabel: input.eventLabel,
    signupLabel: input.signupLabel,
    storageKey: ADS_STORAGE_KEY,
    eventCookie: ADS_EVENT_COOKIE,
    signupCookie: ADS_SIGNUP_COOKIE,
  }).replace(/</g, "\\u003c");

  return `(function () {
  var cfg = ${cfg};
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  var CLICK_RE = ${CLICK_RE.toString()};
  var UTM_RE = ${UTM_RE.toString()};
  var UUID_RE = ${UUID_RE.toString()};
  var KEYS = ${JSON.stringify(ADS_PARAMS)};
  var CLICKS = { gclid: 1, gbraid: 1, wbraid: 1 };
  function sanitize(value) {
    if (!value || typeof value !== "object") return null;
    var out = {};
    var any = false;
    for (var i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      var raw = value[key];
      if (typeof raw !== "string") continue;
      if (!(CLICKS[key] ? CLICK_RE : UTM_RE).test(raw)) continue;
      out[key] = raw;
      any = true;
    }
    return any ? out : null;
  }
  var attr = sanitize(cfg.attribution);
  try {
    if (attr) window.sessionStorage.setItem(cfg.storageKey, JSON.stringify(attr));
    else attr = sanitize(JSON.parse(window.sessionStorage.getItem(cfg.storageKey) || "null"));
  } catch (e) {}
  var pageLocation = "";
  try {
    if (attr) {
      var url = new URL(window.location.href);
      var added = false;
      for (var j = 0; j < KEYS.length; j++) {
        var name = KEYS[j];
        if (attr[name] && !url.searchParams.get(name)) {
          url.searchParams.set(name, attr[name]);
          added = true;
        }
      }
      if (added) pageLocation = url.origin + url.pathname + url.search + url.hash;
    }
  } catch (e) {}
  gtag("js", new Date());
  if (pageLocation) gtag("config", cfg.id, { page_location: pageLocation });
  else gtag("config", cfg.id);
  function readCookie(name) {
    var parts = String(document.cookie || "").split("; ");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].indexOf(name + "=") === 0) {
        try { return decodeURIComponent(parts[i].slice(name.length + 1)); }
        catch (e) { return ""; }
      }
    }
    return "";
  }
  function clearCookie(name) {
    document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax";
  }
  function fire(cookieName, label, kind) {
    var id = readCookie(cookieName);
    if (!id) return;
    if (!UUID_RE.test(id) || !label) { clearCookie(cookieName); return; }
    var dedupe = "kb_ads_fired_" + kind + "_" + id;
    try {
      if (window.sessionStorage.getItem(dedupe)) { clearCookie(cookieName); return; }
      window.sessionStorage.setItem(dedupe, "1");
    } catch (e) {}
    gtag("event", "conversion", { send_to: cfg.id + "/" + label, transaction_id: id });
    clearCookie(cookieName);
  }
  fire(cfg.eventCookie, cfg.eventLabel, "event");
  fire(cfg.signupCookie, cfg.signupLabel, "signup");
})();`;
}

function toParams(value: AdsAttribution): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ADS_PARAMS) {
    const item = value[key];
    if (item) params.set(key, item);
  }
  return params;
}

/** Hosts the Google tag needs. Empty unless the tag id is set. */
export function googleAdsCsp(): { script: string[]; img: string[]; connect: string[]; frame: string[] } {
  if (!googleAdsId()) return { script: [], img: [], connect: [], frame: [] };
  return {
    script: [
      "https://www.googletagmanager.com",
      "https://www.googleadservices.com",
      "https://www.google.com",
      "https://googleads.g.doubleclick.net",
    ],
    img: [
      "https://www.google.com",
      "https://www.google.com.au",
      "https://www.googleadservices.com",
      "https://www.googletagmanager.com",
      "https://googleads.g.doubleclick.net",
    ],
    connect: [
      "https://www.google.com",
      "https://www.google.com.au",
      "https://www.googleadservices.com",
      "https://www.googletagmanager.com",
      "https://googleads.g.doubleclick.net",
      "https://stats.g.doubleclick.net",
    ],
    frame: [
      "https://www.googletagmanager.com",
      "https://googleads.g.doubleclick.net",
      "https://bid.g.doubleclick.net",
    ],
  };
}

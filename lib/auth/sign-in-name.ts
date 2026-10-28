import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { safeNextPath } from "./next-path";

export { NAME_STEP_PATH, pathAfterVerify } from "./verify-destination";

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The code request. The name is optional: it is not a credential, and it is
 * not what limits requests or hides who is on a guest list. Create-an-event
 * still requires one (see codeRequestFieldError) because that screen is
 * "who's running it".
 */
export const requestCodeSchema = z.object({
  fullName: z.preprocess(blankToUndefined, z.string().max(200, "Enter your full name").optional()),
  email: z.string().trim().min(3, "Enter your email").max(254),
  flow: z.enum(["member", "create", "signup", "join"]).default("member"),
  /** The event whose link this came from. Required for "join". */
  event: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

/**
 * Leftover from an earlier draft that signed the name step into the browser.
 * The pending row is the source of truth, so this cookie is no longer set.
 * Claim and sign-out still delete it.
 * TODO: delete the NAME_STEP_COOKIE cleanup once old cookies have expired.
 */
export const NAME_STEP_COOKIE = "kb_name_step";
/** How long a verified code can wait for a name. Well past the old 15 minute cookie. */
export const NAME_STEP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Set once we have seen a display name, so later navigations skip the lookup. */
export const NAMED_COOKIE = "kb_named";
export const NAMED_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Validation that should be a form error, not the neutral "we sent a code"
 * answer. Only create-an-event requires a name up front.
 */
export function codeRequestFieldError(input: { flow: string; fullName?: string }): string | null {
  if (input.flow === "create" && !input.fullName?.trim()) return "Enter your full name";
  return null;
}

/**
 * A name already known for this person: what they typed on this request, or
 * the name saved on the account. Empty means the account is new, so the
 * guest-list name check waits until they type one.
 */
export function knownSignInName(claimed: string | null | undefined, displayName: string | null | undefined): string {
  return claimed?.trim() || displayName?.trim() || "";
}

/** A saved name. Null and whitespace still have to go through the name step. */
export function hasDisplayName(name: string | null | undefined): boolean {
  return Boolean(name?.trim());
}

/**
 * Return path to keep when the name gate bounces someone to /signin/name.
 * An existing valid kb_next wins, so the bounce cannot replace the album
 * they were opening with the page that happened to be gated.
 */
export function returnPathForNameGate(existing: string | null | undefined, here: string): string | null {
  return safeNextPath(existing) ?? safeNextPath(here);
}

/** Link joins have no guest-list name. An empty claim must not fall back to the mailbox. */
export function rosterNameForLinkJoin(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  return trimmed ? trimmed : null;
}

const GATED_APP = /^\/(c|admin|events|ops)(\/|$)/;
const GATED_EVENT = /^\/e(\/|$)/;

/**
 * Product pages a signed-in person with no name must not open yet.
 * /account stays open so they can still delete the account.
 */
export function appPathNeedsName(pathname: string): boolean {
  if (pathname.startsWith("/api/") || pathname.startsWith("/signin") || pathname.startsWith("/start")) return false;
  if (pathname === "/account" || pathname.startsWith("/account/")) return false;
  return GATED_APP.test(pathname) || GATED_EVENT.test(pathname);
}

/** A key that only this purpose can use. The raw server secret is not the HMAC key. */
function purposeKey(secret: string, purpose: string): Buffer {
  return createHmac("sha256", secret).update(purpose).digest();
}

function sign(secret: string, purpose: string, payload: string): string {
  return createHmac("sha256", purposeKey(secret, purpose)).update(payload).digest("base64url");
}

function signatureMatches(secret: string, purpose: string, payload: string, given: string): boolean {
  const expected = sign(secret, purpose, payload);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function encodeNamedCookie(userId: string, exp: number, secret: string): string {
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(secret, NAMED_COOKIE, `named:${payload}`)}`;
}

/** True when this browser was already shown to belong to a named account. */
export function namedCookieMatches(value: string | undefined | null, userId: string, secret: string, now = Date.now()): boolean {
  if (!value || !z.uuid().safeParse(userId).success) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [cookieUser, expText, sig] = parts;
  if (cookieUser !== userId) return false;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return false;
  return signatureMatches(secret, NAMED_COOKIE, `named:${cookieUser}.${expText}`, sig);
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

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

/** Where a new account types a name, after the email code has been accepted. */
export const NAME_STEP_PATH = "/signin/name";
/**
 * Signed reminder of who verified. Not the source of the join: that stays in
 * pending_sign_ins until the name is saved. Long enough that a slow join
 * still works; the server row uses the same lifetime.
 */
export const NAME_STEP_COOKIE = "kb_name_step";
/** How long a verified code can wait for a name. Well past the old 15 minute cookie. */
export const NAME_STEP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Set once we have seen a display name, so later navigations skip the lookup. */
export const NAMED_COOKIE = "kb_named";
export const NAMED_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

export type NameStep = {
  userId: string;
  flow: RequestCodeInput["flow"];
  eventId: string | null;
  /** Unix seconds. The signature covers this along with the other fields. */
  exp: number;
};

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

/** Link joins have no guest-list name. An empty claim must not fall back to the mailbox. */
export function rosterNameForLinkJoin(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  return trimmed ? trimmed : null;
}

const GATED_APP = /^\/(c|admin|events|account|ops)(\/|$)/;
const GATED_EVENT = /^\/e(\/|$)/;

/** Product pages a signed-in person with no name must not open yet. */
export function appPathNeedsName(pathname: string): boolean {
  if (pathname.startsWith("/api/") || pathname.startsWith("/signin") || pathname.startsWith("/start")) return false;
  return GATED_APP.test(pathname) || GATED_EVENT.test(pathname);
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signatureMatches(secret: string, payload: string, given: string): boolean {
  const expected = sign(secret, payload);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** HMAC over userId, flow, eventId and exp. A edited or unsigned cookie reads as nothing. */
export function encodeNameStep(step: NameStep, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId: step.userId, flow: step.flow, eventId: step.eventId, exp: step.exp }),
  ).toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

export function decodeNameStep(value: string | undefined | null, secret: string, now = Date.now()): NameStep | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!signatureMatches(secret, payload, sig)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { userId?: unknown; flow?: unknown; eventId?: unknown; exp?: unknown };
  if (typeof record.userId !== "string" || !z.uuid().safeParse(record.userId).success) return null;
  const flow = requestCodeSchema.shape.flow.safeParse(record.flow);
  if (!flow.success) return null;
  if (typeof record.exp !== "number" || !Number.isFinite(record.exp) || record.exp * 1000 <= now) return null;
  if (record.eventId == null) return { userId: record.userId, flow: flow.data, eventId: null, exp: record.exp };
  if (typeof record.eventId !== "string" || !z.uuid().safeParse(record.eventId).success) return null;
  return { userId: record.userId, flow: flow.data, eventId: record.eventId, exp: record.exp };
}

export function encodeNamedCookie(userId: string, exp: number, secret: string): string {
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(secret, `named:${payload}`)}`;
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
  return signatureMatches(secret, `named:${cookieUser}.${expText}`, sig);
}

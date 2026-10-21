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
/** Remembers the flow and event across that step. HttpOnly, short lived. */
export const NAME_STEP_COOKIE = "kb_name_step";

export type NameStep = { flow: RequestCodeInput["flow"]; eventId: string | null };

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

export function encodeNameStep(step: NameStep): string {
  return JSON.stringify({ flow: step.flow, eventId: step.eventId });
}

export function decodeNameStep(value: string | undefined | null): NameStep | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { flow?: unknown; eventId?: unknown };
  const flow = requestCodeSchema.shape.flow.safeParse(record.flow);
  if (!flow.success) return null;
  if (record.eventId == null) return { flow: flow.data, eventId: null };
  if (typeof record.eventId !== "string" || !z.uuid().safeParse(record.eventId).success) return null;
  return { flow: flow.data, eventId: record.eventId };
}

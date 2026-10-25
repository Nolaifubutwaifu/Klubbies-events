import "server-only";
import { z } from "zod";
import { sendSignInCode } from "@/lib/email/send";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { kickPlanNotices } from "@/lib/billing/notices";
import { eventIsFull, GUESTS_FULL } from "@/lib/billing/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { holdsForNameMismatch } from "./names";
import { LIMITS, RATE_LIMITED, hitRateLimit } from "./rate-limit";
import {
  NAME_STEP_PATH,
  NAME_STEP_TTL_MS,
  knownSignInName,
  requestCodeSchema,
  rosterNameForLinkJoin,
  type RequestCodeInput,
} from "./sign-in-name";

export { NAME_STEP_PATH, requestCodeSchema };
export type { RequestCodeInput };

export const SIGNIN_COOKIE = "kb_signin";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;

export const NEUTRAL_MESSAGE =
  "If that address can open this event, we've sent it a sign-in code. It expires in 10 minutes.";
export const CODE_REJECTED = "That code didn't match. Check the latest email or send a new code.";

export const verifyCodeSchema = z.object({
  // Supabase issues 6 to 10 digit codes depending on the project setting.
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email"),
  /** The event the member arrived for, so they land back in it. */
  event: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

function nowIso() {
  return new Date().toISOString();
}

async function findEligibleMemberships(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select(
      "id, event_id, role, roster_name, claimed_name, status, first_seen_at, grace_ends_at, name_review_at, name_approved_at, events!inner(name, handle, status)",
    )
    .eq("roster_email", email)
    .in("status", ["pending", "active", "grace"])
    .eq("events.status", "active")
    .is("events.deleted_at", null);
  if (error) throw error;
  return (data ?? []).filter((m) => m.status !== "grace" || (m.grace_ends_at !== null && m.grace_ends_at > nowIso()));
}

/** An event that can currently be joined through its link. */
async function findJoinableEvent(handle: string) {
  const { data } = await createAdminClient()
    .from("events")
    .select("id, name, handle, access_mode, status")
    .eq("handle", handle.toLowerCase())
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export type JoinResult = "joined" | "refused" | "full";

/**
 * Makes the attendee row for someone who verified an email through an event
 * in link mode. Someone the organiser removed stays removed. The database
 * refuses a join past the event's guest limit and overflow window
 * (migration 27), which comes back as "full".
 */
export async function joinByLink(eventId: string, userId: string, email: string, name: string | null): Promise<JoinResult> {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, access_mode, status, deleted_at").eq("id", eventId).maybeSingle();
  if (!event || event.status !== "active" || event.deleted_at || event.access_mode !== "link") return "refused";

  const { data: existing } = await admin
    .from("memberships")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("roster_email", email)
    .maybeSingle();
  if (existing) return existing.status === "active" ? "joined" : "refused";

  // No organiser typed this name. Never invent one from the mailbox: that
  // string would then fail the guest-list check, or pass as if it were real.
  const rosterName = rosterNameForLinkJoin(name);
  if (!rosterName) return "refused";

  const { data: role } = await admin.from("event_roles").select("id").eq("event_id", eventId).eq("key", "member").maybeSingle();
  const now = nowIso();
  const { error } = await admin.from("memberships").insert({
    event_id: eventId,
    user_id: userId,
    roster_email: email,
    roster_name: rosterName,
    claimed_name: rosterName,
    role: "event_member",
    role_id: role?.id ?? null,
    status: "active",
    invited_at: now,
    first_seen_at: now,
    accepted_at: now,
  });
  if (error?.code === GUESTS_FULL) return "full";
  if (error) {
    console.error("join by link failed", error);
    return "refused";
  }
  kickPlanNotices(eventId);
  return "joined";
}

async function issueOtp(email: string): Promise<string> {
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && created.error.code !== "email_exists" && created.error.status !== 422) {
    throw created.error;
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return data.properties.email_otp;
}

/**
 * Does the real work of a code request. Callers run it after the response
 * has been sent, so neither timing nor status reveals roster membership.
 */
export async function processCodeRequest(input: RequestCodeInput): Promise<void> {
  const email = normaliseEmail(input.email);
  if (!isValidEmail(email)) return;

  let eventName: string | null = null;
  let eventId: string | null = null;
  if (input.flow === "join") {
    // From an event's own link. In link mode anyone may ask; in guest-list
    // mode only an address already on this event's list gets a code. Either
    // way the caller has already had the same neutral answer.
    const event = input.event ? await findJoinableEvent(input.event) : null;
    if (!event) return;
    const memberships = await findEligibleMemberships(email);
    const mine = memberships.find((m) => m.event_id === event.id);
    if (event.access_mode !== "link" && !mine) return;
    // A full event sends no code to someone who hasn't joined yet; the join
    // screen already said it's full. Guests who joined still sign in.
    if (!mine?.first_seen_at && (await eventIsFull(event.id))) return;
    eventName = event.name;
    eventId = event.id;
  } else if (input.flow === "member") {
    const memberships = await findEligibleMemberships(email);
    if (memberships.length === 0) return;
    eventName = memberships.length === 1 ? memberships[0].events.name : null;
  }

  const code = await issueOtp(email);
  const claimedName = input.fullName?.trim() || null;
  // Leave user_id off the write. A new row stores null; a row already bound
  // to a verified user (the name step) keeps that id. Writing null here let a
  // second code request, including one for someone else's email, unbind them
  // and trap a nameless account on the name screen.
  const { error } = await createAdminClient()
    .from("pending_sign_ins")
    .upsert({
      email,
      claimed_name: claimedName,
      flow: input.flow,
      event_id: eventId,
      attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
  if (error) throw error;

  // No name yet (the usual sign-in): the email greets them without one.
  await sendSignInCode(email, { code, name: claimedName || "there", eventName });
}

/**
 * Checked before answering, so a limited caller hears why instead of waiting
 * for a code that never comes. The limits apply to every address alike, so
 * the answer says nothing about who is on a guest list.
 */
export async function codeRequestLimit(rawEmail: string, ip: string): Promise<string | null> {
  const email = normaliseEmail(rawEmail);
  if (await hitRateLimit(LIMITS.codeRequestPerIp, ip)) return RATE_LIMITED;
  if (await hitRateLimit(LIMITS.codeRequestPerEmail, email)) return EMAIL_LIMITED;
  return null;
}

/**
 * "Send a new code" from the code screen: repeats the request that's waiting
 * for this address, with the name and event it was made with.
 */
export async function resendCode(rawEmail: string): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const admin = createAdminClient();
  const { data: pending } = await admin.from("pending_sign_ins").select("claimed_name, flow, event_id").eq("email", email).maybeSingle();
  // No waiting request means the first one didn't qualify, and neither would this.
  if (!pending) return;
  let event: string | undefined;
  if (pending.event_id) {
    const { data } = await admin.from("events").select("handle").eq("id", pending.event_id).maybeSingle();
    event = data?.handle ?? undefined;
  }
  const flow = requestCodeSchema.shape.flow.safeParse(pending.flow);
  await processCodeRequest({
    fullName: pending.claimed_name?.trim() || undefined,
    email,
    flow: flow.success ? flow.data : "member",
    event,
  });
}

export const EMAIL_LIMITED =
  "You've asked for a few codes already. Use the newest email (check spam too), or wait a few minutes and try again.";

export type VerifyResult =
  | { ok: true; redirectTo: string; namePending?: boolean }
  | { ok: false; error: string };

type CompletedSignIn = {
  userId: string;
  email: string;
  claimedName: string;
  flow: string;
  eventId: string | null;
  eventHandle?: string;
};

/**
 * Links the verified email to its events and, for a guest list, holds the
 * sign-in when the name doesn't match (migration 36). Callers only reach
 * this with a name in hand, so a new account can't see photos before that
 * check runs.
 */
async function completeSignIn(input: CompletedSignIn): Promise<VerifyResult> {
  const admin = createAdminClient();
  const { userId, email, claimedName } = input;
  let handle = input.eventHandle?.toLowerCase();
  if (input.eventId) {
    const { data } = await admin.from("events").select("handle").eq("id", input.eventId).maybeSingle();
    if (data?.handle) handle = data.handle;
  }

  let joinedHandle: string | null = null;
  let linkedEventId: string | null = null;
  if (input.flow === "join" && input.eventId) {
    if ((await joinByLink(input.eventId, userId, email, claimedName)) === "joined") {
      joinedHandle = handle ?? null;
      linkedEventId = input.eventId;
    }
  }

  const memberships = await findEligibleMemberships(email);
  const now = nowIso();

  await Promise.all(
    memberships.map(async (m) => {
      const nameToCompare = m.claimed_name ?? claimedName;
      // The row joinByLink just wrote took its name from this person, not from
      // a guest list, so it cannot be "wrong" and must not be held.
      const mismatch = holdsForNameMismatch(linkedEventId === m.event_id, m.roster_name, nameToCompare);
      // A name that doesn't match the list waits for an organiser (migration
      // 36), unless one already approved this person. Organisers never wait.
      const hold = mismatch && m.role !== "event_admin" && !m.name_approved_at;
      const identity = {
        user_id: userId,
        claimed_name: nameToCompare,
        name_mismatch: mismatch,
        name_review_at: hold ? (m.name_review_at ?? now) : null,
      };
      const { error } = await admin
        .from("memberships")
        .update({
          ...identity,
          first_seen_at: m.first_seen_at ?? now,
          status: m.status === "pending" ? "active" : m.status,
        })
        .eq("id", m.id);
      // On the guest list, but the event filled up before they first signed
      // in: they stay "not joined yet" until the organiser makes room.
      if (error?.code === GUESTS_FULL) await admin.from("memberships").update(identity).eq("id", m.id);
      else if (!m.first_seen_at) kickPlanNotices(m.event_id);
    }),
  );

  await admin.from("users").update({ display_name: claimedName }).eq("id", userId).is("display_name", null);

  if (input.flow === "create") return { ok: true, redirectTo: "/admin/new" };
  if (joinedHandle) return { ok: true, redirectTo: `/e/${joinedHandle}` };
  // A join that was refused (the event filled up, or they were removed) goes
  // to the event anyway, whose page explains why, instead of an empty list.
  if (input.flow === "join" && handle) return { ok: true, redirectTo: `/e/${handle}` };
  // Someone who came in through an event's own link goes back to that event,
  // but only if they are actually on its list.
  if (handle && memberships.some((m) => m.events.handle === handle)) return { ok: true, redirectTo: `/e/${handle}` };
  if (input.flow === "signup") return { ok: true, redirectTo: memberships.length === 1 ? `/e/${memberships[0].events.handle}` : "/events" };
  // An organiser with one event lands on its overview, everyone else on the photos.
  if (memberships.length === 1) {
    const only = memberships[0];
    return { ok: true, redirectTo: only.role === "event_admin" ? `/admin/${only.events.handle}` : `/e/${only.events.handle}` };
  }
  return { ok: true, redirectTo: "/events" };
}

export async function verifyCode(rawEmail: string, code: string, eventHandle?: string): Promise<VerifyResult> {
  const email = normaliseEmail(rawEmail);
  const admin = createAdminClient();

  const { data: pending } = await admin.from("pending_sign_ins").select("*").eq("email", email).maybeSingle();
  if (!pending || pending.expires_at < nowIso() || pending.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: CODE_REJECTED };
  }
  await admin.from("pending_sign_ins").update({ attempts: pending.attempts + 1 }).eq("email", email);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) return { ok: false, error: CODE_REJECTED };
  const userId = data.user.id;

  const { data: profile } = await admin.from("users").select("display_name").eq("id", userId).maybeSingle();
  const claimedName = knownSignInName(pending.claimed_name, profile?.display_name);
  // A new account has no name yet. Don't link the guest list or join the
  // event until they give one, or the mismatch hold (migration 36) never runs.
  // Keep the row until the name is saved. The code itself is spent, and the
  // wait is much longer than the code's ten minutes, so a slow join still lands.
  if (!claimedName) {
    const exp = Date.now() + NAME_STEP_TTL_MS;
    const { error: keepError } = await admin
      .from("pending_sign_ins")
      .update({
        user_id: userId,
        attempts: MAX_VERIFY_ATTEMPTS,
        expires_at: new Date(exp).toISOString(),
      })
      .eq("email", email);
    if (keepError) throw keepError;
    return { ok: true, redirectTo: NAME_STEP_PATH, namePending: true };
  }

  await admin.from("pending_sign_ins").delete().eq("email", email);

  return completeSignIn({
    userId,
    email,
    claimedName,
    flow: pending.flow,
    eventId: pending.event_id,
    eventHandle,
  });
}

export const ALREADY_NAMED = "This account already has a name.";

export type ClaimNameResult = { ok: true; redirectTo: string } | { ok: false; error: string; status: 400 | 401 | 409 };

/**
 * Saves the name from the post-verify screen and finishes the sign-in.
 * The pending row is taken with one delete, so two claims cannot both join.
 * The winner uses that row's flow and event. No row (it expired, a password
 * sign-in never wrote one, or a later code request replaced it) still saves
 * the name and finishes as a member with no event, so a nameless account
 * cannot get stuck on this screen. An account that already has a name cannot
 * run this again.
 */
export async function claimSignInName(input: { userId: string; email: string; name: string }): Promise<ClaimNameResult> {
  const claimedName = input.name.trim();
  if (!claimedName || claimedName.length > 200) return { ok: false, status: 400, error: "Enter your name" };

  const admin = createAdminClient();
  const email = normaliseEmail(input.email);
  const { data: profile } = await admin.from("users").select("display_name").eq("id", input.userId).maybeSingle();
  if (profile?.display_name?.trim()) {
    await admin.from("pending_sign_ins").delete().eq("user_id", input.userId);
    return { ok: false, status: 409, error: ALREADY_NAMED };
  }

  // delete … where user_id = $1 returning *. Only one caller receives the row.
  const { data: taken, error } = await admin.from("pending_sign_ins").delete().eq("user_id", input.userId).select("*");
  if (error) throw error;
  const pending = taken?.[0] ?? null;
  const usable = pending != null && pending.expires_at >= nowIso() && normaliseEmail(pending.email) === email;

  if (usable && pending) {
    // Land the name before the next await so the claim that lost the row
    // observes it and stops, instead of finishing a second time.
    await admin.from("users").update({ display_name: claimedName }).eq("id", input.userId).is("display_name", null);
    const parsedFlow = requestCodeSchema.shape.flow.safeParse(pending.flow);
    const result = await completeSignIn({
      userId: input.userId,
      email,
      claimedName,
      flow: parsedFlow.success ? parsedFlow.data : "member",
      eventId: pending.event_id,
    });
    if (!result.ok) return { ok: false, status: 400, error: result.error };
    return result;
  }

  const { data: again } = await admin.from("users").select("display_name").eq("id", input.userId).maybeSingle();
  if (again?.display_name?.trim()) return { ok: false, status: 409, error: ALREADY_NAMED };

  const result = await completeSignIn({
    userId: input.userId,
    email,
    claimedName,
    flow: "member",
    eventId: null,
  });
  if (!result.ok) return { ok: false, status: 400, error: result.error };
  return result;
}

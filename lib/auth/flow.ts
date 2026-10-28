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

  const admin = createAdminClient();
  const { data: existing } = await admin.from("pending_sign_ins").select("*").eq("email", email).maybeSingle();
  // The route has already answered. A live name-step row still gets a code,
  // so signing out does not lock the account out, and the reply stays the
  // same whichever row was here. An expired bound row is simply gone.
  if (existing?.user_id) {
    const now = nowIso();
    if (existing.expires_at < now) {
      // Match the expired bound row only. A code request that already
      // replaced it has a later expiry, or no user yet, and must stay.
      const { error: deleteError } = await admin
        .from("pending_sign_ins")
        .delete()
        .eq("email", email)
        .lt("expires_at", now)
        .not("user_id", "is", null);
      if (deleteError) throw deleteError;
    } else {
      await sendCodeForBoundRow(existing);
      return;
    }
  }

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
  const pending = {
    claimed_name: claimedName,
    flow: input.flow,
    event_id: eventId,
    attempts: 0,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  };
  // Only an unbound row is replaced. A bound row was handled above, and this
  // update's user_id filter keeps a race from retargeting one.
  const { data: updated, error: updateError } = await admin
    .from("pending_sign_ins")
    .update(pending)
    .eq("email", email)
    .is("user_id", null)
    .select("email");
  if (updateError) throw updateError;
  if (!updated?.length) {
    const { error: insertError } = await admin.from("pending_sign_ins").insert({ email, ...pending });
    if (insertError?.code === "23505") return;
    if (insertError) throw insertError;
  }

  // No name yet (the usual sign-in): the email greets them without one.
  await sendSignInCode(email, { code, name: claimedName || "there", eventName });
}

/** A new code for someone already waiting on the name step. The join stays. */
async function sendCodeForBoundRow(existing: {
  email: string;
  claimed_name: string | null;
  event_id: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const code = await issueOtp(existing.email);
  const codeExpires = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { data: updated, error } = await admin
    .from("pending_sign_ins")
    .update({ code_attempts: 0, code_expires_at: codeExpires })
    .eq("email", existing.email)
    .not("user_id", "is", null)
    .select("email");
  if (error) throw error;
  if (!updated?.length) return;

  let eventName: string | null = null;
  if (existing.event_id) {
    const { data } = await admin.from("events").select("name").eq("id", existing.event_id).maybeSingle();
    eventName = data?.name ?? null;
  }
  await sendSignInCode(existing.email, { code, name: existing.claimed_name?.trim() || "there", eventName });
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

  await saveDisplayNameIfBlank(userId, claimedName);

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

  // spend_sign_in_attempt increments the live counter in the same update that
  // checks the cap, so parallel guesses cannot all pass a counter they read
  // earlier. A bound row uses code_attempts; an unbound row uses attempts.
  const { data: allowed, error: spendError } = await admin.rpc("spend_sign_in_attempt", { p_email: email });
  if (spendError) throw spendError;
  if (allowed !== true) return { ok: false, error: CODE_REJECTED };

  const { data: pending } = await admin.from("pending_sign_ins").select("*").eq("email", email).maybeSingle();
  if (!pending) return { ok: false, error: CODE_REJECTED };
  const bound = pending.user_id != null;

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
    if (bound) {
      // Same account, still waiting for a name. Do not rebind or retarget.
      if (pending.user_id !== userId) return { ok: false, error: CODE_REJECTED };
      const { error: spendError } = await admin
        .from("pending_sign_ins")
        .update({ code_attempts: MAX_VERIFY_ATTEMPTS })
        .eq("email", email);
      if (spendError) throw spendError;
      return { ok: true, redirectTo: NAME_STEP_PATH, namePending: true };
    }
    const exp = Date.now() + NAME_STEP_TTL_MS;
    const { error: keepError } = await admin
      .from("pending_sign_ins")
      .update({
        user_id: userId,
        attempts: MAX_VERIFY_ATTEMPTS,
        expires_at: new Date(exp).toISOString(),
        code_attempts: MAX_VERIFY_ATTEMPTS,
        code_expires_at: nowIso(),
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

/** True when claim_display_name wrote the name. Null, spaces, tabs and NBSP are unnamed. */
async function saveDisplayNameIfBlank(userId: string, displayName: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("claim_display_name", { p_user_id: userId, p_name: displayName });
  if (error) throw error;
  return data === true;
}

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
  // The name write is the lock. A parallel claim updates zero rows and stops,
  // so it cannot finish a second time with its own name.
  const won = await saveDisplayNameIfBlank(input.userId, claimedName);
  // Leave the row. The claim that won the name is the one that deletes it;
  // deleting here can land first and drop the join.
  if (!won) return { ok: false, status: 409, error: ALREADY_NAMED };

  // delete … where user_id = $1 returning *. Only this caller still has the row.
  const { data: taken, error } = await admin.from("pending_sign_ins").delete().eq("user_id", input.userId).select("*");
  if (error) throw error;
  const pending = taken?.[0] ?? null;
  const usable = pending != null && pending.expires_at >= nowIso() && normaliseEmail(pending.email) === email;
  const parsedFlow = usable && pending ? requestCodeSchema.shape.flow.safeParse(pending.flow) : null;
  const result = await completeSignIn({
    userId: input.userId,
    email,
    claimedName,
    flow: parsedFlow?.success ? parsedFlow.data : "member",
    eventId: usable && pending ? pending.event_id : null,
  });
  // The name is already saved. A failure here is 400 once; the next claim is
  // 409, and that response redirects to the return path or /events
  // (docs/decisions.md, 2026-10-25).
  if (!result.ok) return { ok: false, status: 400, error: result.error };
  return result;
}

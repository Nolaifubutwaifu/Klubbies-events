import "server-only";
import { z } from "zod";
import { sendSignInCode } from "@/lib/email/send";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { kickPlanNotices } from "@/lib/billing/notices";
import { eventIsFull, GUESTS_FULL } from "@/lib/billing/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { namesLooselyMatch } from "./names";
import { LIMITS, RATE_LIMITED, hitRateLimit } from "./rate-limit";

export const SIGNIN_COOKIE = "kb_signin";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;

export const NEUTRAL_MESSAGE =
  "If that address can open this event, we've sent it a sign-in code. It expires in 10 minutes.";
export const CODE_REJECTED = "That code didn't match. Check the latest email or send a new code.";

export const requestCodeSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(200),
  email: z.string().trim().min(3, "Enter your email").max(254),
  flow: z.enum(["member", "create", "signup", "join"]).default("member"),
  /** The event whose link this came from. Required for "join". */
  event: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

export const verifyCodeSchema = z.object({
  // Supabase issues 6 to 10 digit codes depending on the project setting.
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email"),
  /** The event the member arrived for, so they land back in it. */
  event: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

function nowIso() {
  return new Date().toISOString();
}

async function findEligibleMemberships(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id, event_id, role, roster_name, claimed_name, status, first_seen_at, grace_ends_at, events!inner(name, handle, status)")
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

  const { data: role } = await admin.from("event_roles").select("id").eq("event_id", eventId).eq("key", "member").maybeSingle();
  const now = nowIso();
  const { error } = await admin.from("memberships").insert({
    event_id: eventId,
    user_id: userId,
    roster_email: email,
    roster_name: name?.trim() || email.split("@")[0],
    claimed_name: name,
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
  const { error } = await createAdminClient()
    .from("pending_sign_ins")
    .upsert({
      email,
      claimed_name: input.fullName,
      flow: input.flow,
      event_id: eventId,
      attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
  if (error) throw error;

  await sendSignInCode(email, { code, name: input.fullName, eventName });
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
  await processCodeRequest({ fullName: pending.claimed_name ?? "", email, flow: flow.success ? flow.data : "member", event });
}

export const EMAIL_LIMITED =
  "You've asked for a few codes already. Use the newest email (check spam too), or wait a few minutes and try again.";

export type VerifyResult = { ok: true; redirectTo: string } | { ok: false; error: string };

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

  await admin.from("pending_sign_ins").delete().eq("email", email);

  // Joining through the link happens before the roster pass below, so the
  // new row gets the same first-sign-in treatment as everyone else's.
  let joinedHandle: string | null = null;
  if (pending.flow === "join" && pending.event_id) {
    if ((await joinByLink(pending.event_id, userId, email, pending.claimed_name)) === "joined") {
      const { data: joined } = await admin.from("events").select("handle").eq("id", pending.event_id).maybeSingle();
      joinedHandle = joined?.handle ?? null;
    }
  }

  const memberships = await findEligibleMemberships(email);
  const claimedName = pending.claimed_name;
  const now = nowIso();

  await Promise.all(
    memberships.map(async (m) => {
      const nameToCompare = m.claimed_name ?? claimedName;
      const identity = {
        user_id: userId,
        claimed_name: nameToCompare,
        name_mismatch: nameToCompare ? !namesLooselyMatch(m.roster_name, nameToCompare) : false,
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

  if (claimedName) {
    await admin.from("users").update({ display_name: claimedName }).eq("id", userId).is("display_name", null);
  }

  if (pending.flow === "create") return { ok: true, redirectTo: "/admin/new" };
  if (joinedHandle) return { ok: true, redirectTo: `/e/${joinedHandle}` };
  // A join that was refused (the event filled up, or they were removed) goes
  // to the event anyway, whose page explains why, instead of an empty list.
  if (pending.flow === "join" && eventHandle) return { ok: true, redirectTo: `/e/${eventHandle.toLowerCase()}` };
  // Someone who came in through an event's own link goes back to that event,
  // but only if they are actually on its list.
  const wanted = eventHandle?.toLowerCase();
  if (wanted && memberships.some((m) => m.events.handle === wanted)) return { ok: true, redirectTo: `/e/${wanted}` };
  if (pending.flow === "signup") return { ok: true, redirectTo: memberships.length === 1 ? `/e/${memberships[0].events.handle}` : "/events" };
  // An organiser with one event lands on its overview, everyone else on the photos.
  if (memberships.length === 1) {
    const only = memberships[0];
    return { ok: true, redirectTo: only.role === "event_admin" ? `/admin/${only.events.handle}` : `/e/${only.events.handle}` };
  }
  return { ok: true, redirectTo: "/events" };
}

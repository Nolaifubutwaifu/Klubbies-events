import "server-only";
import { z } from "zod";
import { sendSignInCode } from "@/lib/email/send";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { namesLooselyMatch } from "./names";
import { LIMITS, hitRateLimit } from "./rate-limit";

export const SIGNIN_COOKIE = "kb_signin";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;

export const NEUTRAL_MESSAGE =
  "If that address is on a club member list, we've sent it a sign-in code. It expires in 10 minutes.";
export const CODE_REJECTED = "That code didn't match. Check the latest email or send a new code.";

export const requestCodeSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(200),
  email: z.string().trim().min(3, "Enter your email").max(254),
  flow: z.enum(["member", "create", "signup"]).default("member"),
});

export const verifyCodeSchema = z.object({
  // Supabase issues 6 to 10 digit codes depending on the project setting.
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email"),
  /** The club the member arrived for, so they land back in it. */
  club: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

function nowIso() {
  return new Date().toISOString();
}

async function findEligibleMemberships(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id, club_id, roster_name, claimed_name, status, first_seen_at, grace_ends_at, clubs!inner(name, handle, status)")
    .eq("roster_email", email)
    .in("status", ["pending", "active", "grace"])
    .eq("clubs.status", "active");
  if (error) throw error;
  return (data ?? []).filter((m) => m.status !== "grace" || (m.grace_ends_at !== null && m.grace_ends_at > nowIso()));
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
export async function processCodeRequest(input: RequestCodeInput, ip: string): Promise<void> {
  const email = normaliseEmail(input.email);
  if (!isValidEmail(email)) return;

  const [emailLimited, ipLimited] = await Promise.all([
    hitRateLimit(LIMITS.codeRequestPerEmail, email),
    hitRateLimit(LIMITS.codeRequestPerIp, ip),
  ]);
  if (emailLimited || ipLimited) return;

  let clubName: string | null = null;
  if (input.flow === "member") {
    const memberships = await findEligibleMemberships(email);
    if (memberships.length === 0) return;
    clubName = memberships.length === 1 ? memberships[0].clubs.name : null;
  }

  const code = await issueOtp(email);
  const { error } = await createAdminClient()
    .from("pending_sign_ins")
    .upsert({
      email,
      claimed_name: input.fullName,
      flow: input.flow,
      attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
  if (error) throw error;

  await sendSignInCode(email, { code, name: input.fullName, clubName });
}

export type VerifyResult = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function verifyCode(rawEmail: string, code: string, clubHandle?: string): Promise<VerifyResult> {
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

  const memberships = await findEligibleMemberships(email);
  const claimedName = pending.claimed_name;
  const now = nowIso();

  await Promise.all(
    memberships.map((m) => {
      const nameToCompare = m.claimed_name ?? claimedName;
      return admin
        .from("memberships")
        .update({
          user_id: userId,
          first_seen_at: m.first_seen_at ?? now,
          status: m.status === "pending" ? "active" : m.status,
          claimed_name: nameToCompare,
          name_mismatch: nameToCompare ? !namesLooselyMatch(m.roster_name, nameToCompare) : false,
        })
        .eq("id", m.id);
    }),
  );

  if (claimedName) {
    await admin.from("users").update({ display_name: claimedName }).eq("id", userId).is("display_name", null);
  }

  if (pending.flow === "create") return { ok: true, redirectTo: "/admin/new" };
  // A member who came in through a club's own link goes back to that club,
  // but only if they are actually on its list.
  const wanted = clubHandle?.toLowerCase();
  if (wanted && memberships.some((m) => m.clubs.handle === wanted)) return { ok: true, redirectTo: `/c/${wanted}` };
  if (pending.flow === "signup") return { ok: true, redirectTo: memberships.length === 1 ? `/c/${memberships[0].clubs.handle}` : "/clubs" };
  if (memberships.length === 1) return { ok: true, redirectTo: `/c/${memberships[0].clubs.handle}` };
  return { ok: true, redirectTo: "/clubs" };
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, RATE_LIMITED, hitRateLimit } from "@/lib/auth/rate-limit";
import { NEXT_COOKIE, safeNextPath } from "@/lib/auth/next-path";
import { clientFingerprint } from "@/lib/auth/request";
import { normaliseEmail } from "@/lib/roster/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(200),
  event: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

const GENERIC = "That email and password don't match. Try a code instead.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: GENERIC }, { status: 400 });

  const { ip } = await clientFingerprint();
  if (await hitRateLimit(LIMITS.verifyPerIp, ip)) return NextResponse.json({ error: RATE_LIMITED }, { status: 429 });

  const email = normaliseEmail(parsed.data.email);
  if (await hitRateLimit(LIMITS.passwordPerEmail, email)) return NextResponse.json({ error: RATE_LIMITED }, { status: 429 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error || !data.user) return NextResponse.json({ error: GENERIC }, { status: 400 });

  // Where to land: a single event goes straight in, otherwise the event list.
  const { data: memberships } = await createAdminClient()
    .from("memberships")
    .select("accepted_at, events!inner(handle, status)")
    .eq("user_id", data.user.id)
    .in("status", ["active", "grace"])
    .eq("events.status", "active");

  const accepted = (memberships ?? []).filter((m) => m.accepted_at !== null);
  const wanted = parsed.data.event?.toLowerCase();
  // An event's own link always goes back to that event: if they aren't in it
  // yet, its page offers to join (link mode) or explains the guest list.
  const cookieStore = await cookies();
  const next = safeNextPath(cookieStore.get(NEXT_COOKIE)?.value);
  cookieStore.delete(NEXT_COOKIE);
  const redirectTo = next
    ? next
    : wanted
    ? `/e/${wanted}`
    : accepted.length === 1
        ? `/e/${accepted[0].events.handle}`
        : "/events";
  return NextResponse.json({ ok: true, redirectTo });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, hitRateLimit } from "@/lib/auth/rate-limit";
import { clientFingerprint } from "@/lib/auth/request";
import { normaliseEmail } from "@/lib/roster/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(200),
  club: z.string().regex(/^[a-z0-9_]{1,48}$/i).optional(),
});

const GENERIC = "That email and password don't match. Try a code instead.";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: GENERIC }, { status: 400 });

  const { ip } = await clientFingerprint();
  if (await hitRateLimit(LIMITS.verifyPerIp, ip)) return NextResponse.json({ error: GENERIC }, { status: 429 });

  const email = normaliseEmail(parsed.data.email);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error || !data.user) return NextResponse.json({ error: GENERIC }, { status: 400 });

  // Where to land: a single club goes straight in, otherwise the club list.
  const { data: memberships } = await createAdminClient()
    .from("memberships")
    .select("accepted_at, clubs!inner(handle, status)")
    .eq("user_id", data.user.id)
    .in("status", ["active", "grace"])
    .eq("clubs.status", "active");

  const accepted = (memberships ?? []).filter((m) => m.accepted_at !== null);
  const wanted = parsed.data.club?.toLowerCase();
  const redirectTo =
    wanted && accepted.some((m) => m.clubs.handle === wanted)
      ? `/c/${wanted}`
      : accepted.length === 1
        ? `/c/${accepted[0].clubs.handle}`
        : "/clubs";
  return NextResponse.json({ ok: true, redirectTo });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CODE_REJECTED, SIGNIN_COOKIE, verifyCode, verifyCodeSchema } from "@/lib/auth/flow";
import { LIMITS, hitRateLimit } from "@/lib/auth/rate-limit";
import { clientFingerprint } from "@/lib/auth/request";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = verifyCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? CODE_REJECTED }, { status: 400 });
  }

  const cookieStore = await cookies();
  const email = cookieStore.get(SIGNIN_COOKIE)?.value;
  if (!email) {
    return NextResponse.json({ error: "Your sign in timed out. Start again." }, { status: 400 });
  }

  const { ip } = await clientFingerprint();
  if (await hitRateLimit(LIMITS.verifyPerIp, ip)) {
    return NextResponse.json({ error: CODE_REJECTED }, { status: 400 });
  }

  const result = await verifyCode(email, parsed.data.code, parsed.data.club);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  cookieStore.delete(SIGNIN_COOKIE);
  return NextResponse.json({ ok: true, redirectTo: result.redirectTo });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SIGNIN_COOKIE, codeRequestLimit, resendCode } from "@/lib/auth/flow";
import { clientFingerprint } from "@/lib/auth/request";

const SEND_FAILED = "We couldn't send a new code. Check your signal and try again.";

export async function POST() {
  const email = (await cookies()).get(SIGNIN_COOKIE)?.value;
  if (!email) return NextResponse.json({ error: "Your sign in timed out. Start again." }, { status: 400 });

  const { ip } = await clientFingerprint();
  const limited = await codeRequestLimit(email, ip);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  // The first request stays neutral and sends after the response, so timing
  // doesn't reveal the guest list. A resend is someone who already asked:
  // they need to know whether the new code actually went out.
  try {
    const sent = await resendCode(email);
    if (!sent) return NextResponse.json({ error: SEND_FAILED }, { status: 502 });
  } catch (error) {
    console.error("resend_code failed", error);
    return NextResponse.json({ error: SEND_FAILED }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

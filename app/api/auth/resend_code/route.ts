import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { SIGNIN_COOKIE, codeRequestLimit, resendCode } from "@/lib/auth/flow";
import { clientFingerprint } from "@/lib/auth/request";

export async function POST() {
  const email = (await cookies()).get(SIGNIN_COOKIE)?.value;
  if (!email) return NextResponse.json({ error: "Your sign in timed out. Start again." }, { status: 400 });

  const { ip } = await clientFingerprint();
  const limited = await codeRequestLimit(email, ip);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  // Same as the first request: the work happens after the answer, so the
  // answer is identical whether or not a code goes out.
  after(async () => {
    try {
      await resendCode(email);
    } catch (error) {
      console.error("resend_code failed", error);
    }
  });
  return NextResponse.json({ ok: true });
}

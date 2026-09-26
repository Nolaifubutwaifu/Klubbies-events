import { after, NextResponse } from "next/server";
import { NEUTRAL_MESSAGE, SIGNIN_COOKIE, processCodeRequest, requestCodeSchema } from "@/lib/auth/flow";
import { clientFingerprint } from "@/lib/auth/request";
import { normaliseEmail } from "@/lib/roster/email";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = requestCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  }

  const { ip } = await clientFingerprint();

  // Roster lookup, code generation and email all happen after the response,
  // so every request gets the same answer in the same time.
  after(async () => {
    try {
      await processCodeRequest(parsed.data, ip);
    } catch (error) {
      console.error("request_code failed", error);
    }
  });

  const response = NextResponse.json({ ok: true, message: NEUTRAL_MESSAGE });
  response.cookies.set(SIGNIN_COOKIE, normaliseEmail(parsed.data.email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
  return response;
}

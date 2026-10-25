import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { claimSignInName } from "@/lib/auth/flow";
import { NEXT_COOKIE, safeNextPath } from "@/lib/auth/next-path";
import { LIMITS, RATE_LIMITED, hitRateLimit } from "@/lib/auth/rate-limit";
import { clientFingerprint } from "@/lib/auth/request";
import { NAME_STEP_COOKIE, NAMED_COOKIE, NAMED_COOKIE_TTL_MS, encodeNamedCookie } from "@/lib/auth/sign-in-name";
import { getSessionUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(200, "Enter your name"),
});

const EXPIRED = "Your sign in timed out. Start again.";

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const finish = (response: NextResponse) => {
    cookieStore.delete(NAME_STEP_COOKIE);
    return response;
  };

  // Auth before the body, so a signed-out caller learns nothing from the parser.
  const user = await getSessionUser();
  if (!user?.email) return finish(NextResponse.json({ error: EXPIRED }, { status: 401 }));

  const { ip } = await clientFingerprint();
  if ((await hitRateLimit(LIMITS.claimNamePerUser, user.id)) || (await hitRateLimit(LIMITS.claimNamePerIp, ip))) {
    return finish(NextResponse.json({ error: RATE_LIMITED }, { status: 429 }));
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return finish(NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter your name" }, { status: 400 }));
  }

  const result = await claimSignInName({ userId: user.id, email: user.email, name: parsed.data.name });
  if (!result.ok) return finish(NextResponse.json({ error: result.error }, { status: result.status }));

  const next = safeNextPath(cookieStore.get(NEXT_COOKIE)?.value);
  cookieStore.delete(NEXT_COOKIE);
  const exp = Math.floor((Date.now() + NAMED_COOKIE_TTL_MS) / 1000);
  cookieStore.set(NAMED_COOKIE, encodeNamedCookie(user.id, exp, serverEnv().SIGNED_URL_SECRET), {
    ...cookieBase(),
    maxAge: Math.floor(NAMED_COOKIE_TTL_MS / 1000),
  });
  const redirectTo = next && result.redirectTo !== "/admin/new" ? next : result.redirectTo;
  return finish(NextResponse.json({ ok: true, redirectTo }));
}

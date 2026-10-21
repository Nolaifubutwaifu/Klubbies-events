import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { claimSignInName } from "@/lib/auth/flow";
import { NEXT_COOKIE, safeNextPath } from "@/lib/auth/next-path";
import { NAME_STEP_COOKIE, decodeNameStep } from "@/lib/auth/sign-in-name";
import { getSessionUser } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(200, "Enter your name"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter your name" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Your sign in timed out. Start again." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const pending = decodeNameStep(cookieStore.get(NAME_STEP_COOKIE)?.value);
  const result = await claimSignInName({
    userId: user.id,
    email: user.email,
    name: parsed.data.name,
    pending,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  cookieStore.delete(NAME_STEP_COOKIE);
  const next = safeNextPath(cookieStore.get(NEXT_COOKIE)?.value);
  cookieStore.delete(NEXT_COOKIE);
  const redirectTo = next && result.redirectTo !== "/admin/new" ? next : result.redirectTo;
  return NextResponse.json({ ok: true, redirectTo });
}

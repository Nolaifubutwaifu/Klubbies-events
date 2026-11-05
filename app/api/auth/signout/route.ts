import { NextResponse } from "next/server";
import { NAME_STEP_COOKIE, NAMED_COOKIE } from "@/lib/auth/sign-in-name";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const scope = form?.get("scope") === "global" ? "global" : "local";
  const supabase = await createClient();
  await supabase.auth.signOut({ scope });
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.delete(NAME_STEP_COOKIE);
  response.cookies.delete(NAMED_COOKIE);
  return response;
}

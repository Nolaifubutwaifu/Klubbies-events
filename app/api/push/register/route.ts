import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// The iPhone app calls this with its APNs device token once the person has
// allowed notifications, and again on later launches (tokens can change).
// A token belongs to whoever is signed in on that phone now, so a second
// person signing in on the same phone takes it over.

const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{32,200}$/i),
  environment: z.enum(["sandbox", "production"]),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { error } = await createAdminClient()
    .from("push_devices")
    .upsert(
      { token: parsed.data.token.toLowerCase(), environment: parsed.data.environment, user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) return NextResponse.json({ error: "Could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Turning notifications off in the app, or signing out on this phone. */
export async function DELETE(request: Request) {
  const parsed = z.object({ token: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await createAdminClient().from("push_devices").delete().eq("token", parsed.data.token.toLowerCase()).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

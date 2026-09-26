import { NextResponse } from "next/server";
import { z } from "zod";
import { getClubContextById, getProfile } from "@/lib/auth/session";
import { applySetupIntent, createCardSetupIntent, stripeConfigured } from "@/lib/billing/stripe";

const startSchema = z.object({ clubId: z.uuid() });
const finishSchema = z.object({ clubId: z.uuid(), setupIntentId: z.string().regex(/^seti_/) });

/** Starts a card update: returns a SetupIntent secret for Stripe Elements. */
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Payments aren't configured" }, { status: 500 });
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const ctx = await getClubContextById(parsed.data.clubId);
  if (!ctx?.perms.manage_club) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await getProfile();
  try {
    const clientSecret = await createCardSetupIntent(ctx.club, profile?.email ?? "");
    return NextResponse.json({ clientSecret });
  } catch (error) {
    console.error("setup intent failed", error);
    return NextResponse.json({ error: "Could not start the card update" }, { status: 500 });
  }
}

/** Finishes a card update: makes the new card the default for the club. */
export async function PUT(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Payments aren't configured" }, { status: 500 });
  const parsed = finishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const ctx = await getClubContextById(parsed.data.clubId);
  if (!ctx?.perms.manage_club) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const ok = await applySetupIntent(ctx.club, parsed.data.setupIntentId);
    if (!ok) return NextResponse.json({ error: "That card wasn't confirmed" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("apply setup intent failed", error);
    return NextResponse.json({ error: "Could not save that card" }, { status: 500 });
  }
}

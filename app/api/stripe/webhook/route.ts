import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { handleStripeEvent, stripe, stripeEnv } from "@/lib/billing/stripe";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe → Klubbies. Register this URL in the Stripe dashboard for:
// checkout.session.completed, checkout.session.async_payment_succeeded,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted.
export async function POST(request: Request) {
  const secret = stripeEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, payload: event as unknown as Json });
  if (insertError) {
    if (insertError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  }

  try {
    const clubId = await handleStripeEvent(event);
    await admin.from("stripe_events").update({ processed_at: new Date().toISOString(), club_id: clubId }).eq("id", event.id);
  } catch (error) {
    console.error("stripe webhook failed", event.id, error);
    // Let Stripe retry: forget the event so the retry is processed.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

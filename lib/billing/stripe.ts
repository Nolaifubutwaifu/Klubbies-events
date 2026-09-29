import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import type { EventRecord } from "@/lib/db/types";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPlanNotices } from "./notices";
import { isTier, KEEP_YEAR_AUD, planName, TIER_ORDER, TIERS, tierLimits, type Rate, type Tier, type TierOffer } from "./plans";
import { statusFromSubscription, type BillingStatus } from "./status";

const priceId = z.string().regex(/^price_/).optional();

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_/, "STRIPE_SECRET_KEY is not set"),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/).optional(),
  // The six tier prices, one-off, in AUD (pricing handoff §2). Optional: a
  // tier without its price ID is charged from lib/billing/plans.ts instead,
  // but then a promotion code limited to a product (FOUNDING25 to Medium)
  // can't apply to it.
  STRIPE_PRICE_SMALL_CLUB: priceId,
  STRIPE_PRICE_SMALL_STANDARD: priceId,
  STRIPE_PRICE_MEDIUM_CLUB: priceId,
  STRIPE_PRICE_MEDIUM_STANDARD: priceId,
  STRIPE_PRICE_LARGE_CLUB: priceId,
  STRIPE_PRICE_LARGE_STANDARD: priceId,
  // Keep another year, A$29 one-off. Optional like the others.
  STRIPE_PRICE_KEEP_YEAR: priceId,
});

export function stripeConfigured(): boolean {
  return stripeSchema.safeParse(process.env).success;
}

export function stripeEnv() {
  return stripeSchema.parse(process.env);
}

let client: Stripe | undefined;

export function stripe(): Stripe {
  client ??= new Stripe(stripeEnv().STRIPE_SECRET_KEY);
  return client;
}

function tierPriceId(tier: Tier, rate: Rate): string | undefined {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${rate.toUpperCase()}` as keyof ReturnType<typeof stripeEnv>;
  return stripeEnv()[key];
}

function offerLabel(offer: TierOffer): string {
  const to = TIERS[offer.to].name;
  const late = offer.late ? " (late)" : "";
  if (offer.kind === "upgrade") return `Upgrade ${planName(offer.from)} to ${to}${late}`;
  return `Klubbies Events ${to}, ${offer.rate === "club" ? "club rate" : "standard"}${late}`;
}

/**
 * One Checkout payment for a tier or an upgrade. Moving off Free at the list
 * price uses the tier's Stripe price, so promotion codes like FOUNDING25 can
 * apply; everything else is charged the amount lib/billing/plans.ts works out.
 * Promotion codes are off for upgrades from a paid tier.
 */
export async function createCheckoutSession(
  event: EventRecord,
  email: string,
  offer: TierOffer,
  /** The organiser screen Stripe sends them back to: the setup steps or the billing page. */
  returnTo: "billing" | "setup" = "billing",
): Promise<string> {
  const billingUrl = `${appUrl()}/admin/${event.handle}/${returnTo}`;
  const metadata = {
    event_id: event.id,
    event_handle: event.handle,
    kind: offer.kind,
    from_plan: offer.from,
    to_plan: offer.to,
    rate: offer.rate,
    late: offer.late ? "1" : "0",
    list_amount_cents: String(offer.amount * 100),
    club_code: event.club_code ?? "",
  };
  const listPrice = offer.kind === "tier" && !offer.late ? tierPriceId(offer.to, offer.rate) : undefined;
  const lineItem = listPrice
    ? { price: listPrice, quantity: 1 }
    : {
        quantity: 1,
        price_data: { currency: "aud", unit_amount: offer.amount * 100, product_data: { name: offerLabel(offer) } },
      };

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
    client_reference_id: event.id,
    metadata,
    ...(event.stripe_customer_id ? { customer: event.stripe_customer_id } : { customer_email: email || undefined, customer_creation: "always" as const }),
    payment_intent_data: { metadata, description: `${offerLabel(offer)}: ${event.name}` },
    // Companies pay for events: a real invoice, with their billing details,
    // is what their accounts team asks for.
    invoice_creation: { enabled: true, invoice_data: { metadata, description: `${offerLabel(offer)}: ${event.name}` } },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    allow_promotion_codes: offer.kind === "tier",
    success_url: `${billingUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${billingUrl}?canceled=1`,
  });

  await createAdminClient().from("events").update({ stripe_checkout_session_id: session.id }).eq("id", event.id);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** "Keep another year": one A$29 payment that moves the deletion date 12 months on. */
export async function createKeepYearCheckout(event: EventRecord, email: string): Promise<string> {
  const billingUrl = `${appUrl()}/admin/${event.handle}/billing`;
  const metadata = { event_id: event.id, event_handle: event.handle, kind: "keep_year", list_amount_cents: String(KEEP_YEAR_AUD * 100) };
  const price = stripeEnv().STRIPE_PRICE_KEEP_YEAR;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      price
        ? { price, quantity: 1 }
        : { quantity: 1, price_data: { currency: "aud", unit_amount: KEEP_YEAR_AUD * 100, product_data: { name: "Keep another year" } } },
    ],
    client_reference_id: event.id,
    metadata,
    ...(event.stripe_customer_id ? { customer: event.stripe_customer_id } : { customer_email: email || undefined, customer_creation: "always" as const }),
    payment_intent_data: { metadata, description: `Keep another year: ${event.name}` },
    invoice_creation: { enabled: true, invoice_data: { metadata, description: `Keep another year: ${event.name}` } },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    allow_promotion_codes: false,
    success_url: `${billingUrl}?session_id={CHECKOUT_SESSION_ID}#keep`,
    cancel_url: `${billingUrl}?canceled=1#keep`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(event: EventRecord): Promise<string> {
  if (!event.stripe_customer_id) throw new Error("This event has no Stripe customer");
  const session = await stripe().billingPortal.sessions.create({
    customer: event.stripe_customer_id,
    return_url: `${appUrl()}/admin/${event.handle}/billing`,
  });
  return session.url;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Applies a completed Checkout Session: moves the event to the tier it paid
 * for and records the purchase. Safe to run twice (the webhook and the return
 * from Checkout both call it): the purchase row is unique per session, and a
 * plan only moves up from the plan the session was bought from.
 */
export async function applyCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const eventId = session.metadata?.event_id ?? session.client_reference_id;
  if (!eventId) return null;
  if (session.status !== "complete" || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    return eventId;
  }
  const kind = session.metadata?.kind;
  if (kind === "keep_year") {
    await applyKeepYear(eventId, session);
    return eventId;
  }
  if (kind === "tier" || kind === "upgrade") {
    await applyTierPurchase(eventId, session);
    return eventId;
  }

  const { error } = await createAdminClient()
    .from("events")
    .update({
      billing_status: "active",
      stripe_customer_id: idOf(session.customer),
      stripe_subscription_id: idOf(session.subscription),
      stripe_checkout_session_id: session.id,
      paid_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .neq("billing_status", "comped");
  if (error) throw error;
  // A session from before tiers (no kind in its metadata) bought the old
  // unlimited event, so that is what it gets.
  await setUnlimited(eventId);
  return eventId;
}

async function applyTierPurchase(eventId: string, session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata ?? {};
  const to = meta.to_plan;
  const rate = meta.rate === "club" ? "club" : "standard";
  if (!isTier(to)) throw new Error(`checkout session ${session.id} names no tier`);
  const admin = createAdminClient();

  const { error: purchaseError } = await admin.from("event_purchases").insert({
    event_id: eventId,
    kind: meta.kind === "upgrade" ? "upgrade" : "tier",
    from_plan: meta.from_plan ?? null,
    to_plan: to,
    rate,
    late: meta.late === "1",
    amount_cents: session.amount_total ?? 0,
    list_amount_cents: Number(meta.list_amount_cents ?? 0) || 0,
    currency: session.currency ?? "aud",
    club_code: meta.club_code || null,
    promotion_code: typeof session.discounts?.[0]?.promotion_code === "string" ? session.discounts[0].promotion_code : null,
    stripe_session_id: session.id,
  });
  if (purchaseError?.code === "23505") return; // already applied
  if (purchaseError) throw purchaseError;

  const { data: event } = await admin.from("events").select("plan, paid_at").eq("id", eventId).maybeSingle();
  if (!event) return;
  await admin
    .from("events")
    .update({
      billing_status: "active",
      stripe_customer_id: idOf(session.customer),
      stripe_checkout_session_id: session.id,
      paid_at: event.paid_at ?? new Date().toISOString(),
    })
    .eq("id", eventId)
    .neq("billing_status", "comped");

  // Only ever up: a late, out-of-order session for a smaller tier is recorded
  // (it was paid for) but doesn't shrink the event.
  if (isTier(event.plan) && TIER_ORDER.indexOf(to) <= TIER_ORDER.indexOf(event.plan)) return;
  if (!isTier(event.plan)) return; // unlimited or custom already
  const { guestLimit, photoLimit } = tierLimits(to);
  const { error } = await admin.rpc("apply_event_plan", {
    p_event_id: eventId,
    p_plan: to,
    p_rate: rate,
    p_guest_limit: guestLimit,
    p_photo_limit: photoLimit,
  });
  if (error) throw error;
  // Paused guests were just let in: email them.
  await checkPlanNotices(eventId).catch((noticeError) => console.error("let-in emails after upgrade", eventId, noticeError));
}

/** Adds a year: the database trigger moves the deletion date, the closing date with it, and clears the warnings. */
async function applyKeepYear(eventId: string, session: Stripe.Checkout.Session): Promise<void> {
  const admin = createAdminClient();
  const { error: purchaseError } = await admin.from("event_purchases").insert({
    event_id: eventId,
    kind: "keep_year",
    amount_cents: session.amount_total ?? 0,
    list_amount_cents: KEEP_YEAR_AUD * 100,
    currency: session.currency ?? "aud",
    stripe_session_id: session.id,
  });
  if (purchaseError?.code === "23505") return; // already applied
  if (purchaseError) throw purchaseError;
  const { data: event } = await admin.from("events").select("extra_years, photos_deleted_at").eq("id", eventId).maybeSingle();
  if (!event || event.photos_deleted_at) return; // too late: nothing left to keep
  const { error } = await admin
    .from("events")
    .update({ extra_years: event.extra_years + 1, stripe_customer_id: idOf(session.customer) })
    .eq("id", eventId);
  if (error) throw error;
}

async function setUnlimited(eventId: string): Promise<void> {
  const { error } = await createAdminClient().rpc("apply_event_plan", {
    p_event_id: eventId,
    p_plan: "unlimited",
    p_rate: null,
    p_guest_limit: null,
    p_photo_limit: null,
  });
  if (error) throw error;
}

export async function applySubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const admin = createAdminClient();
  let eventId: string | null = subscription.metadata?.event_id ?? null;
  if (!eventId) {
    const { data } = await admin.from("events").select("id").eq("stripe_subscription_id", subscription.id).maybeSingle();
    eventId = data?.id ?? null;
  }
  if (!eventId) return null;

  const status: BillingStatus = statusFromSubscription(subscription.status);
  const { error } = await admin
    .from("events")
    .update({ billing_status: status, stripe_subscription_id: subscription.id, stripe_customer_id: idOf(subscription.customer) })
    .eq("id", eventId)
    .neq("billing_status", "comped");
  if (error) throw error;
  return eventId;
}

/** Returns the event the stripeEvent concerned, or null when the stripeEvent is ignored. */
export async function handleStripeEvent(stripeEvent: Stripe.Event): Promise<string | null> {
  switch (stripeEvent.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return applyCheckoutSession(stripeEvent.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applySubscription(stripeEvent.data.object);
    default:
      return null;
  }
}

/**
 * Called when the admin returns from Checkout, so the event activates even if
 * the webhook hasn't arrived yet. The session must belong to this event.
 */
export async function syncReturnedSession(sessionId: string, eventId: string): Promise<boolean> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return false;
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if ((session.metadata?.event_id ?? session.client_reference_id) !== eventId) return false;
  await applyCheckoutSession(session);
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

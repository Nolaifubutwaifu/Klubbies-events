import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import type { Club } from "@/lib/db/types";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusFromSubscription, type BillingStatus } from "./status";

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_/, "STRIPE_SECRET_KEY is not set"),
  STRIPE_PRICE_ID: z.string().regex(/^price_/, "STRIPE_PRICE_ID is not set"),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/).optional(),
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

export type PriceSummary = { label: string; recurring: boolean };

export async function getPriceSummary(): Promise<PriceSummary> {
  const price = await stripe().prices.retrieve(stripeEnv().STRIPE_PRICE_ID);
  const amount = new Intl.NumberFormat("en-AU", { style: "currency", currency: price.currency.toUpperCase() }).format(
    (price.unit_amount ?? 0) / 100,
  );
  if (!price.recurring) return { label: `${amount} one-off`, recurring: false };
  const { interval, interval_count: count } = price.recurring;
  return { label: `${amount} / ${count > 1 ? `${count} ${interval}s` : interval}`, recurring: true };
}

export async function createCheckoutSession(club: Club, email: string): Promise<string> {
  const { STRIPE_PRICE_ID } = stripeEnv();
  const price = await stripe().prices.retrieve(STRIPE_PRICE_ID);
  const mode = price.recurring ? "subscription" : "payment";
  const billingUrl = `${appUrl()}/admin/${club.handle}/billing`;
  const metadata = { club_id: club.id, club_handle: club.handle };

  const session = await stripe().checkout.sessions.create({
    mode,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: club.id,
    metadata,
    ...(club.stripe_customer_id ? { customer: club.stripe_customer_id } : { customer_email: email }),
    ...(mode === "subscription"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata }, customer_creation: "always" as const }),
    allow_promotion_codes: true,
    success_url: `${billingUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${billingUrl}?canceled=1`,
  });

  await createAdminClient().from("clubs").update({ stripe_checkout_session_id: session.id }).eq("id", club.id);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(club: Club): Promise<string> {
  if (!club.stripe_customer_id) throw new Error("This club has no Stripe customer");
  const session = await stripe().billingPortal.sessions.create({
    customer: club.stripe_customer_id,
    return_url: `${appUrl()}/admin/${club.handle}/billing`,
  });
  return session.url;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Activates the club a completed Checkout Session belongs to. Comped clubs are left alone. */
export async function applyCheckoutSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const clubId = session.metadata?.club_id ?? session.client_reference_id;
  if (!clubId) return null;
  if (session.status !== "complete" || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    return clubId;
  }

  const { error } = await createAdminClient()
    .from("clubs")
    .update({
      billing_status: "active",
      stripe_customer_id: idOf(session.customer),
      stripe_subscription_id: idOf(session.subscription),
      stripe_checkout_session_id: session.id,
      paid_at: new Date().toISOString(),
    })
    .eq("id", clubId)
    .neq("billing_status", "comped");
  if (error) throw error;
  return clubId;
}

export async function applySubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const admin = createAdminClient();
  let clubId: string | null = subscription.metadata?.club_id ?? null;
  if (!clubId) {
    const { data } = await admin.from("clubs").select("id").eq("stripe_subscription_id", subscription.id).maybeSingle();
    clubId = data?.id ?? null;
  }
  if (!clubId) return null;

  const status: BillingStatus = statusFromSubscription(subscription.status);
  const { error } = await admin
    .from("clubs")
    .update({ billing_status: status, stripe_subscription_id: subscription.id, stripe_customer_id: idOf(subscription.customer) })
    .eq("id", clubId)
    .neq("billing_status", "comped");
  if (error) throw error;
  return clubId;
}

/** Returns the club the event concerned, or null when the event is ignored. */
export async function handleStripeEvent(event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return applyCheckoutSession(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applySubscription(event.data.object);
    default:
      return null;
  }
}

/**
 * Called when the admin returns from Checkout, so the club activates even if
 * the webhook hasn't arrived yet. The session must belong to this club.
 */
export async function syncReturnedSession(sessionId: string, clubId: string): Promise<boolean> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return false;
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if ((session.metadata?.club_id ?? session.client_reference_id) !== clubId) return false;
  await applyCheckoutSession(session);
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export type CardSummary = { brand: string; last4: string; expMonth: number; expYear: number } | null;

/** Makes sure the club has a Stripe customer, so cards can be saved before checkout. */
export async function ensureCustomer(club: Club, email: string): Promise<string> {
  if (club.stripe_customer_id) return club.stripe_customer_id;
  const customer = await stripe().customers.create({
    email: email || undefined,
    name: club.name,
    metadata: { club_id: club.id, club_handle: club.handle },
  });
  await createAdminClient().from("clubs").update({ stripe_customer_id: customer.id }).eq("id", club.id);
  return customer.id;
}

export async function createCardSetupIntent(club: Club, email: string): Promise<string> {
  const customer = await ensureCustomer(club, email);
  const intent = await stripe().setupIntents.create({
    customer,
    usage: "off_session",
    // Cards only: this form exists to keep the subscription card up to date.
    payment_method_types: ["card"],
    metadata: { club_id: club.id },
  });
  if (!intent.client_secret) throw new Error("Stripe did not return a client secret");
  return intent.client_secret;
}

/** Makes the card from a completed SetupIntent the default for the club. */
export async function applySetupIntent(club: Club, setupIntentId: string): Promise<boolean> {
  const intent = await stripe().setupIntents.retrieve(setupIntentId);
  if (intent.metadata?.club_id !== club.id || intent.status !== "succeeded") return false;
  const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
  if (!paymentMethod || !customer) return false;

  await stripe().customers.update(customer, { invoice_settings: { default_payment_method: paymentMethod } });
  if (club.stripe_subscription_id) {
    await stripe().subscriptions.update(club.stripe_subscription_id, { default_payment_method: paymentMethod });
  }
  return true;
}

export async function getDefaultCard(club: Club): Promise<CardSummary> {
  if (!club.stripe_customer_id) return null;
  const customer = await stripe().customers.retrieve(club.stripe_customer_id, { expand: ["invoice_settings.default_payment_method"] });
  if (customer.deleted) return null;
  const method = customer.invoice_settings?.default_payment_method;
  const card = typeof method === "string" ? null : method?.card;
  if (!card) {
    const methods = await stripe().paymentMethods.list({ customer: club.stripe_customer_id, type: "card", limit: 1 });
    const fallback = methods.data[0]?.card;
    if (!fallback) return null;
    return { brand: fallback.brand, last4: fallback.last4, expMonth: fallback.exp_month, expYear: fallback.exp_year };
  }
  return { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year };
}

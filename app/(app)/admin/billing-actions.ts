"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEventContextById, getProfile } from "@/lib/auth/session";
import { headers } from "next/headers";
import { z } from "zod";
import { CLUB_CODES, normaliseClubCode } from "@/lib/billing/club-codes";
import { isTier, tierOffers } from "@/lib/billing/plans";
import { createCheckoutSession, createPortalSession, stripeConfigured } from "@/lib/billing/stripe";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { createAdminClient } from "@/lib/supabase/admin";

async function billingContext(eventId: string) {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.isAdmin) throw new Error("Not authorised");
  return ctx;
}

/**
 * Pay for a tier, or an upgrade, on Stripe's Checkout page. Never from inside
 * the iPhone app: Apple allows no other way to pay there.
 */
export async function startCheckoutAction(eventId: string, tier: string): Promise<void> {
  const ctx = await billingContext(eventId);
  const billing = `/admin/${ctx.event.handle}/billing`;
  if (isNativeAppUserAgent((await headers()).get("user-agent"))) redirect(billing);
  const offer = tierOffers(ctx.event).find((o) => o.to === tier);
  if (!offer || !isTier(tier)) redirect(billing);
  const profile = await getProfile();
  let url: string;
  try {
    url = await createCheckoutSession(ctx.event, profile?.email ?? "", offer);
  } catch (error) {
    console.error("checkout failed", error);
    redirect(`${billing}?error=checkout`);
  }
  redirect(url);
}

export type BillingFormState = { error?: string; message?: string; ok?: boolean };

/**
 * A campus club code switches the event to club prices, until its first
 * payment fixes the rate for good.
 */
export async function setClubCodeAction(eventId: string, _prev: BillingFormState, form: FormData): Promise<BillingFormState> {
  const ctx = await billingContext(eventId);
  const raw = String(form.get("code") ?? "");
  if (ctx.event.plan_rate) return { error: "This event's price is already set by its first payment." };
  if (!raw.trim()) {
    await createAdminClient().from("events").update({ club_code: null }).eq("id", ctx.event.id);
    revalidatePath(`/admin/${ctx.event.handle}/billing`);
    return { ok: true, message: "Club code removed" };
  }
  const code = normaliseClubCode(raw);
  if (!code) return { error: "That isn't a club code we know. Check it with whoever gave it to you." };
  await createAdminClient().from("events").update({ club_code: code }).eq("id", ctx.event.id);
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return { ok: true, message: `Club prices applied (${CLUB_CODES[code]})` };
}

/** "About how many guests?": suggests a size, and is what the join rate is measured against. */
export async function setExpectedGuestsAction(eventId: string, _prev: BillingFormState, form: FormData): Promise<BillingFormState> {
  const ctx = await billingContext(eventId);
  const parsed = z.coerce.number().int().min(1).max(100000).safeParse(form.get("expected"));
  if (!parsed.success) return { error: "Enter a number of guests" };
  await createAdminClient().from("events").update({ expected_guests: parsed.data }).eq("id", ctx.event.id);
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Saved" };
}

export async function openBillingPortalAction(eventId: string): Promise<void> {
  const ctx = await billingContext(eventId);
  let url: string;
  try {
    url = await createPortalSession(ctx.event);
  } catch (error) {
    console.error("billing portal failed", error);
    redirect(`/admin/${ctx.event.handle}/billing?error=portal`);
  }
  redirect(url);
}

/**
 * Local development has no Stripe keys, which would leave every event locked.
 * Outside production, with Stripe unconfigured, an organiser can mark their
 * own event complimentary. Never available in production.
 */
export async function devActivateAction(eventId: string): Promise<void> {
  const ctx = await billingContext(eventId);
  if (process.env.NODE_ENV === "production" || stripeConfigured()) redirect(`/admin/${ctx.event.handle}/billing`);
  const admin = createAdminClient();
  await admin.from("events").update({ billing_status: "comped" }).eq("id", ctx.event.id);
  // Comped events are unlimited, like the ones comped before tiers existed.
  await admin.rpc("apply_event_plan", { p_event_id: ctx.event.id, p_plan: "unlimited", p_rate: null, p_guest_limit: null, p_photo_limit: null });
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  redirect(`/admin/${ctx.event.handle}/setup`);
}

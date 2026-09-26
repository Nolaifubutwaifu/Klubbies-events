"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEventContextById, getProfile } from "@/lib/auth/session";
import { createCheckoutSession, createPortalSession, stripeConfigured } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

async function billingContext(eventId: string) {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.isAdmin) throw new Error("Not authorised");
  return ctx;
}

export async function startCheckoutAction(eventId: string): Promise<void> {
  const ctx = await billingContext(eventId);
  const profile = await getProfile();
  let url: string;
  try {
    url = await createCheckoutSession(ctx.event, profile?.email ?? "");
  } catch (error) {
    console.error("checkout failed", error);
    redirect(`/admin/${ctx.event.handle}/billing?error=checkout`);
  }
  redirect(url);
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
  await createAdminClient().from("events").update({ billing_status: "comped" }).eq("id", ctx.event.id);
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  redirect(`/admin/${ctx.event.handle}/setup`);
}

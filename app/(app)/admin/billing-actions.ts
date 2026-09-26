"use server";

import { redirect } from "next/navigation";
import { getEventContextById, getProfile } from "@/lib/auth/session";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";

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

"use server";

import { redirect } from "next/navigation";
import { getClubContextById, getProfile } from "@/lib/auth/session";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";

async function billingContext(clubId: string) {
  const ctx = await getClubContextById(clubId);
  if (!ctx?.isAdmin) throw new Error("Not authorised");
  return ctx;
}

export async function startCheckoutAction(clubId: string): Promise<void> {
  const ctx = await billingContext(clubId);
  const profile = await getProfile();
  let url: string;
  try {
    url = await createCheckoutSession(ctx.club, profile?.email ?? "");
  } catch (error) {
    console.error("checkout failed", error);
    redirect(`/admin/${ctx.club.handle}/billing?error=checkout`);
  }
  redirect(url);
}

export async function openBillingPortalAction(clubId: string): Promise<void> {
  const ctx = await billingContext(clubId);
  let url: string;
  try {
    url = await createPortalSession(ctx.club);
  } catch (error) {
    console.error("billing portal failed", error);
    redirect(`/admin/${ctx.club.handle}/billing?error=portal`);
  }
  redirect(url);
}

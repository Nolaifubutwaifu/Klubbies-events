"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getEventContextById, getProfile } from "@/lib/auth/session";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import { sendPhotographerLink } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { formatLongDate } from "@/lib/format";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { hashToken, newGuestToken } from "@/lib/guest/links";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./actions";

/** The freshly minted link, returned once and never stored in full. */
export type GuestLinkState = ActionState & { url?: string };

const schema = z.object({
  label: z.string().trim().min(2, "Say who the link is for").max(120),
  albumId: z.uuid("Pick the album uploads land in"),
  expiresOn: z.iso.date("Give the link an end date"),
});

export async function createGuestLinkAction(eventId: string, _prev: GuestLinkState, form: FormData): Promise<GuestLinkState> {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.perms.manage_albums) return { error: "Not authorised" };
  if (!canWrite(ctx.event)) return { error: ACTIVATE_MESSAGE };

  const parsed = schema.safeParse({
    label: String(form.get("label") ?? "").trim(),
    albumId: String(form.get("albumId") ?? ""),
    expiresOn: String(form.get("expiresOn") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // End of the chosen day, so "expires 7 Nov" means the 7th still works.
  const expiresAt = new Date(`${parsed.data.expiresOn}T23:59:59`);
  if (Number.isNaN(expiresAt.getTime())) return { error: "Give the link an end date" };
  if (expiresAt.getTime() <= Date.now()) return { error: "Pick a date in the future" };

  const supabase = await createClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("id", parsed.data.albumId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!album) return { error: "That album isn't in this event" };

  const token = newGuestToken();
  const { error } = await supabase.from("album_guest_links").insert({
    event_id: eventId,
    album_id: album.id,
    label: parsed.data.label,
    token_hash: await hashToken(token),
    expires_at: expiresAt.toISOString(),
    created_by: ctx.userId,
  });
  if (error) return { error: "Could not make the link" };

  revalidatePath(`/admin/${ctx.event.handle}/photographers`);
  return { ok: true, url: `${appUrl()}/g/${token}` };
}

export async function revokeGuestLinkAction(linkId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: link } = await supabase.from("album_guest_links").select("id, event_id").eq("id", linkId).maybeSingle();
  if (!link) return { error: "Link not found" };
  const ctx = await getEventContextById(link.event_id);
  if (!ctx?.perms.manage_albums) return { error: "Not authorised" };

  const { error } = await supabase
    .from("album_guest_links")
    .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId })
    .eq("id", linkId);
  if (error) return { error: "Could not turn the link off" };

  revalidatePath(`/admin/${ctx.event.handle}/photographers`);
  return { ok: true, message: "Link revoked. It stops working straight away." };
}

/**
 * Emails a just-made photographer link. The link is checked against this
 * event's own links by its hash first, so this can't be used to send any
 * other address through our mail.
 */
export async function emailGuestLinkAction(eventId: string, url: string, rawEmail: string): Promise<ActionState> {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.perms.manage_albums) return { error: "Not authorised" };
  const email = normaliseEmail(rawEmail);
  if (!isValidEmail(email)) return { error: "Enter the photographer's email" };

  const token = url.startsWith(`${appUrl()}/g/`) ? url.slice(`${appUrl()}/g/`.length) : "";
  if (!token) return { error: "That link isn't from this event" };
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("album_guest_links")
    .select("expires_at, revoked_at, albums(title)")
    .eq("event_id", eventId)
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!link || link.revoked_at) return { error: "That link isn't from this event" };

  const profile = await getProfile();
  try {
    await sendPhotographerLink(email, {
      eventName: ctx.event.name,
      albumTitle: link.albums?.title ?? "the event album",
      organiser: ctx.event.organisation || profile?.display_name || "The organiser",
      url,
      expiresOn: formatLongDate(link.expires_at),
    });
  } catch (error) {
    console.error("photographer link email failed", error);
    return { error: "Couldn't send it. Copy the link instead." };
  }
  return { ok: true, message: `Sent to ${email}` };
}

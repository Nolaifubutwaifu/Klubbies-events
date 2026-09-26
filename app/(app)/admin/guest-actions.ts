"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import { appUrl } from "@/lib/env";
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

export async function createGuestLinkAction(clubId: string, _prev: GuestLinkState, form: FormData): Promise<GuestLinkState> {
  const ctx = await getClubContextById(clubId);
  if (!ctx?.perms.manage_albums) return { error: "Not authorised" };
  if (!canWrite(ctx.club.billing_status)) return { error: ACTIVATE_MESSAGE };

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
    .eq("club_id", clubId)
    .maybeSingle();
  if (!album) return { error: "That album isn't in this club" };

  const token = newGuestToken();
  const { error } = await supabase.from("album_guest_links").insert({
    club_id: clubId,
    album_id: album.id,
    label: parsed.data.label,
    token_hash: await hashToken(token),
    expires_at: expiresAt.toISOString(),
    created_by: ctx.userId,
  });
  if (error) return { error: "Could not make the link" };

  revalidatePath(`/admin/${ctx.club.handle}/guests`);
  return { ok: true, url: `${appUrl()}/g/${token}` };
}

export async function revokeGuestLinkAction(linkId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: link } = await supabase.from("album_guest_links").select("id, club_id").eq("id", linkId).maybeSingle();
  if (!link) return { error: "Link not found" };
  const ctx = await getClubContextById(link.club_id);
  if (!ctx?.perms.manage_albums) return { error: "Not authorised" };

  const { error } = await supabase
    .from("album_guest_links")
    .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId })
    .eq("id", linkId);
  if (error) return { error: "Could not turn the link off" };

  revalidatePath(`/admin/${ctx.club.handle}/guests`);
  return { ok: true, message: "Link revoked. It stops working straight away." };
}

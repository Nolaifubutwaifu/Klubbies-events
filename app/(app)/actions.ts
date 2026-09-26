"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEMBER_NOTICE_VERSION } from "@/lib/faces/constants";
import { AREA_COOKIE } from "@/lib/area";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type Result = { error?: string; ok?: boolean; message?: string };

/**
 * Switches between member and admin view without moving the user off the page
 * they are on.
 */
export async function setAreaAction(area: "member" | "admin", path: string): Promise<void> {
  await requireUser();
  const store = await cookies();
  store.set(AREA_COOKIE, area === "admin" ? "admin" : "member", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const safePath = path.startsWith("/") ? path : "/clubs";
  revalidatePath(safePath, "layout");
  redirect(safePath);
}

export async function acceptInviteAction(membershipId: string, acknowledgedFaceNotice = false): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first" };
  if (!z.uuid().safeParse(membershipId).success) return { error: "Unknown invitation" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({
      accepted_at: new Date().toISOString(),
      declined_at: null,
      // Stamped in the same write as the join, so a member who was told at
      // the door is never asked again inside.
      ...(acknowledgedFaceNotice
        ? { face_notice_ack_at: new Date().toISOString(), face_notice_version: MEMBER_NOTICE_VERSION }
        : {}),
    })
    .eq("id", membershipId)
    .eq("user_id", user.id)
    .select("clubs(handle, name)")
    .maybeSingle();
  if (error || !data) return { error: "Could not accept that invitation" };

  revalidatePath("/", "layout");
  return { ok: true, message: `You're in ${data.clubs?.name ?? "the club"}` };
}

export async function declineInviteAction(membershipId: string): Promise<Result> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in first" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ declined_at: new Date().toISOString() })
    .eq("id", membershipId)
    .eq("user_id", user.id);
  if (error) return { error: "Could not decline that invitation" };
  revalidatePath("/", "layout");
  return { ok: true, message: "We've let the club know" };
}

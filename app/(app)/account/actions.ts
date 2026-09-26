"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { removeObjects } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export type AccountResult = { error?: string; ok?: boolean; message?: string };

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(120),
  bio: z.string().trim().max(500),
});

export async function updateProfileAction(_prev: AccountResult, form: FormData): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    displayName: String(form.get("displayName") ?? ""),
    bio: String(form.get("bio") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ display_name: parsed.data.displayName, bio: parsed.data.bio || null })
    .eq("id", user.id);
  if (error) return { error: "Could not save your profile" };
  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function setAvatarAction(path: string | null): Promise<AccountResult> {
  const user = await requireUser();
  if (path !== null && !path.startsWith(`avatars/${user.id}/`)) return { error: "Invalid photo path" };
  const supabase = await createClient();
  const { data: before } = await supabase.from("users").select("avatar_url").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("users").update({ avatar_url: path }).eq("id", user.id);
  if (error) return { error: "Could not save your photo" };
  // New name per upload, so nobody is shown the old photo from a cached URL.
  if (before?.avatar_url && before.avatar_url !== path && before.avatar_url.startsWith(`avatars/${user.id}/`)) {
    await removeObjects([before.avatar_url]).catch((removeError) => console.error("could not remove old avatar", removeError));
  }
  revalidatePath("/account");
  return { ok: true };
}

export async function setNotificationsAction(prefs: {
  notify_new_album: boolean;
  notify_feed_post: boolean;
  notify_access_ending: boolean;
}): Promise<AccountResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("users").update(prefs).eq("id", user.id);
  if (error) return { error: "Could not save your email settings" };
  revalidatePath("/account");
  return { ok: true, message: "Saved" };
}

export async function setPasswordAction(_prev: AccountResult, form: FormData): Promise<AccountResult> {
  await requireUser();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters" };
  if (password !== confirm) return { error: "The two passwords don't match" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
  if (error) return { error: error.message };
  return { ok: true, message: "Password set. You can now sign in with it." };
}

/**
 * Turns on the new-album email from wherever a member is standing — the empty
 * club screen asks for exactly this and nothing else, so it shouldn't send
 * them to their profile to find one switch.
 */
export async function notifyOnNewAlbumsAction(): Promise<AccountResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ notify_new_album: true }).eq("id", user.id);
  if (error) return { error: "Could not turn that on. Try again." };
  revalidatePath("/account");
  return { ok: true, message: "We'll email you when the next album is shared." };
}

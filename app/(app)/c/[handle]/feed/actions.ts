"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getClubContext } from "@/lib/auth/session";
import { REACTIONS } from "@/lib/feed/queries";
import { notifyFeedPost } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";

export type FeedResult = { error?: string; ok?: boolean };

async function memberContext(handle: string) {
  const ctx = await getClubContext(handle);
  if (!ctx?.membership) throw new Error("Not a member of this club");
  return ctx;
}

const bodySchema = z.string().trim().min(1, "Write something first").max(4000);

export async function createPostAction(handle: string, _prev: FeedResult, form: FormData): Promise<FeedResult> {
  const ctx = await memberContext(handle);
  if (!ctx.perms.post_feed) return { error: "Only the committee can post here" };
  const parsed = bodySchema.safeParse(form.get("body"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const albumId = form.get("albumId");

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      club_id: ctx.club.id,
      author_membership_id: ctx.membership!.id,
      body: parsed.data,
      album_id: typeof albumId === "string" && z.uuid().safeParse(albumId).success ? albumId : null,
    })
    .select("id")
    .single();
  if (error || !post) return { error: "Could not post that" };

  after(async () => {
    try {
      await notifyFeedPost(ctx.club.id, post.id, ctx.userId);
    } catch (notifyError) {
      console.error("feed notification failed", notifyError);
    }
  });

  revalidatePath(`/c/${handle}/feed`);
  return { ok: true };
}

export async function deletePostAction(handle: string, postId: string): Promise<FeedResult> {
  await memberContext(handle);
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: "Could not delete that post" };
  revalidatePath(`/c/${handle}/feed`);
  return { ok: true };
}

export async function togglePinAction(handle: string, postId: string, pinned: boolean): Promise<FeedResult> {
  const ctx = await memberContext(handle);
  if (!ctx.perms.manage_club) return { error: "Only admins can pin posts" };
  const supabase = await createClient();
  const { error } = await supabase.from("posts").update({ pinned }).eq("id", postId);
  if (error) return { error: "Could not update that post" };
  revalidatePath(`/c/${handle}/feed`);
  return { ok: true };
}

export async function toggleReactionAction(handle: string, postId: string, emoji: string): Promise<FeedResult> {
  const ctx = await memberContext(handle);
  if (!REACTIONS.includes(emoji as (typeof REACTIONS)[number])) return { error: "Unknown reaction" };
  const supabase = await createClient();
  const membershipId = ctx.membership!.id;

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("membership_id", membershipId)
    .eq("emoji", emoji)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("membership_id", membershipId)
        .eq("emoji", emoji)
    : await supabase.from("post_reactions").insert({ post_id: postId, membership_id: membershipId, club_id: ctx.club.id, emoji });
  if (error) return { error: "Could not react" };
  revalidatePath(`/c/${handle}/feed`);
  return { ok: true };
}

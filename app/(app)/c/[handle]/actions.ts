"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { listAlbumMedia, type GridItem } from "@/lib/media/queries";
import { createClient } from "@/lib/supabase/server";

export async function loadAlbumPageAction(
  albumId: string,
  page: number,
  includeProcessing = false,
): Promise<{ items: GridItem[]; hasMore: boolean }> {
  const id = z.uuid().parse(albumId);
  const pageNumber = z.number().int().min(0).max(10000).parse(page);
  if (!(await getSessionUser())) return { items: [], hasMore: false };
  // RLS limits results to what the caller may see; processing items only
  // come back for club admins.
  return listAlbumMedia(await createClient(), id, pageNumber, { includeProcessing });
}

/**
 * Stamps "you were here" on the caller's membership. Called after the club
 * page renders, so that render still shows what arrived since last time.
 */
export async function markClubVisitedAction(clubId: string): Promise<void> {
  const id = z.uuid().parse(clubId);
  if (!(await getSessionUser())) return;
  const supabase = await createClient();
  // A definer function: members can't write their own membership row directly.
  await supabase.rpc("touch_club_visit", { p_club_id: id });
}

/**
 * Adds or removes one favourite for the caller. Returns the state it landed in
 * so the button can settle without a refetch.
 */
export async function toggleFavouriteAction(mediaId: string): Promise<{ favourited: boolean }> {
  const id = z.uuid().parse(mediaId);
  const user = await getSessionUser();
  if (!user) return { favourited: false };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("favourites")
    .select("media_id")
    .eq("media_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("favourites").delete().eq("media_id", id).eq("user_id", user.id);
    return { favourited: false };
  }

  // Look the club up rather than trusting the caller. A trigger re-derives it
  // anyway, and the insert policy then checks membership of that club, so a
  // caller can't favourite into a club they aren't in.
  const { data: media } = await supabase.from("media").select("club_id").eq("id", id).maybeSingle();
  if (!media) return { favourited: false };

  const { error } = await supabase
    .from("favourites")
    .insert({ media_id: id, user_id: user.id, club_id: media.club_id });
  return { favourited: !error };
}

/**
 * Favourites a batch in one go, for the selection bar. Always adds rather than
 * toggling: you picked five photos to keep, so unpicking two of them because
 * they were already saved would be a surprise.
 */
export async function favouriteManyAction(mediaIds: string[]): Promise<{ saved: number; error?: string }> {
  const ids = mediaIds.filter((id) => z.uuid().safeParse(id).success).slice(0, 200);
  if (!ids.length) return { saved: 0 };
  const user = await getSessionUser();
  if (!user) return { saved: 0, error: "Sign in again to save these." };

  const supabase = await createClient();
  // The club comes from the media rows, so a caller can't favourite into a
  // club they aren't in — the insert policy checks membership of that club.
  const { data: media } = await supabase.from("media").select("id, club_id").in("id", ids);
  if (!media?.length) return { saved: 0, error: "Those photos are no longer here." };

  const { error } = await supabase
    .from("favourites")
    .upsert(media.map((m) => ({ media_id: m.id, user_id: user.id, club_id: m.club_id })));
  if (error) return { saved: 0, error: "Could not save those. Try again." };
  return { saved: media.length };
}

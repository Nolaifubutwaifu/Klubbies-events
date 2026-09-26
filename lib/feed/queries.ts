import "server-only";
import type { ClubContext } from "@/lib/auth/session";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";
import { personName } from "@/lib/auth/display-name";

export const REACTIONS = ["👍", "🎉", "❤️", "😂"] as const;

export type FeedPost = {
  id: string;
  body: string;
  createdAt: string;
  pinned: boolean;
  authorName: string;
  authorRole: string | null;
  authorInitials: string;
  isMine: boolean;
  canDelete: boolean;
  album: { id: string; title: string; meta: string; coverUrl: string | null } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function listFeed(supabase: UserClient, ctx: ClubContext, limit = 30): Promise<FeedPost[]> {
  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      // post_reactions also joins posts to memberships, so the relationship has to
      // be named or PostgREST refuses the embed (PGRST201).
      "id, body, pinned, created_at, album_id, author_membership_id, memberships!posts_author_membership_id_fkey(roster_name, claimed_name, user_id, club_roles(name), users!memberships_user_id_fkey(display_name)), albums(id, title, cover_media_id, cover_path)",
    )
    .eq("club_id", ctx.club.id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  // Swallowing this turned any query failure into a convincing "Nothing posted
  // yet", which is exactly how the feed looked while posts sat in the table.
  if (error) throw error;
  if (!posts?.length) return [];

  const postIds = posts.map((p) => p.id);
  const [{ data: reactions }, { data: counts }] = await Promise.all([
    supabase.from("post_reactions").select("post_id, emoji, membership_id").in("post_id", postIds),
    supabase
      .from("album_media_counts")
      .select("*")
      .in("album_id", posts.map((p) => p.album_id).filter((id): id is string => Boolean(id))),
  ]);

  const countByAlbum = new Map((counts ?? []).map((c) => [c.album_id, c]));
  const coverIds = posts
    .map((p) => p.albums?.cover_media_id ?? (p.album_id ? countByAlbum.get(p.album_id)?.first_media_id : null))
    .filter((id): id is string => Boolean(id));
  const { data: covers } = coverIds.length
    ? await supabase.from("media").select("id, thumb_path, poster_path").in("id", coverIds)
    : { data: [] };
  const coverPath = new Map((covers ?? []).map((c) => [c.id, c.thumb_path ?? c.poster_path]));
  const customCovers = posts.map((p) => p.albums?.cover_path).filter((p): p is string => Boolean(p));
  const urls = await signPaths(
    supabase,
    [...coverPath.values(), ...customCovers].filter((p): p is string => Boolean(p)),
    SIGNED_URL_TTL.thumb,
  );

  const myMembershipId = ctx.membership?.id ?? null;

  return posts.map((post) => {
    const author = post.memberships;
    const authorName =
      (author
        ? personName({ displayName: author.users?.display_name, claimedName: author.claimed_name, rosterName: author.roster_name })
        : "") || "Someone";
    const mine = author?.user_id === ctx.userId;
    const albumCountRow = post.album_id ? countByAlbum.get(post.album_id) : undefined;
    const coverId = post.albums?.cover_media_id ?? albumCountRow?.first_media_id ?? null;
    const coverStoragePath = post.albums?.cover_path ?? (coverId ? coverPath.get(coverId) : null);

    const postReactions = (reactions ?? []).filter((r) => r.post_id === post.id);
    return {
      id: post.id,
      body: post.body,
      createdAt: post.created_at,
      pinned: post.pinned,
      authorName,
      authorRole: author?.club_roles?.name ?? null,
      authorInitials: initials(authorName),
      isMine: mine,
      canDelete: mine || ctx.perms.manage_club,
      album: post.albums
        ? {
            id: post.albums.id,
            title: post.albums.title,
            meta: `${(albumCountRow?.photo_count ?? 0).toLocaleString("en-AU")} photos`,
            coverUrl: coverStoragePath ? (urls.get(coverStoragePath) ?? null) : null,
          }
        : null,
      reactions: REACTIONS.map((emoji) => {
        const mineReacted = postReactions.some((r) => r.emoji === emoji && r.membership_id === myMembershipId);
        return { emoji, count: postReactions.filter((r) => r.emoji === emoji).length, mine: mineReacted };
      }),
    };
  });
}

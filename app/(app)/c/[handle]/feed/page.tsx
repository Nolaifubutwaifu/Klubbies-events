import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getClubContext } from "@/lib/auth/session";
import { listFeed } from "@/lib/feed/queries";
import { listAlbums } from "@/lib/media/queries";
import { createClient } from "@/lib/supabase/server";
import { Composer, PostList } from "./Feed";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Club feed" };

export default async function FeedPage(props: PageProps<"/c/[handle]/feed">) {
  const { handle } = await props.params;
  const ctx = await getClubContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [posts, { albums }, memberCount, committee] = await Promise.all([
    listFeed(supabase, ctx),
    listAlbums(supabase, ctx.club.id, { includeDrafts: ctx.perms.manage_albums }),
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("club_id", ctx.club.id)
      .in("status", ["active", "pending"]),
    supabase
      .from("memberships")
      .select("id, roster_name, claimed_name, club_roles!inner(name, manage_club, manage_members, manage_albums), users!memberships_user_id_fkey(display_name)")
      .eq("club_id", ctx.club.id)
      .eq("status", "active")
      .limit(30),
  ]);

  const latest = albums[0];
  const committeeList = (committee.data ?? [])
    .filter((m) => m.club_roles.manage_club || m.club_roles.manage_members || m.club_roles.manage_albums)
    .slice(0, 6);

  return (
    <main className="grid flex-1 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="border-divider md:border-r-2">
        <div className="px-6 pb-4 pt-6">
          <h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
            Club feed
          </h1>
          <p className="mt-2 text-[15px] text-ink-70">
            Notices from the committee. Only members of {ctx.club.name} can read this.
          </p>
        </div>

        {ctx.perms.post_feed ? (
          <div className="px-6 pb-6">
            <Composer
              handle={handle}
              albums={albums.map((a) => ({ id: a.id, title: a.title }))}
              memberCount={memberCount.count ?? 0}
            />
          </div>
        ) : null}

        {posts.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState title="Nothing posted yet">
              {ctx.perms.post_feed
                ? "Post the first notice: a reminder, a thank you, or a link to the newest album."
                : "When the committee posts a notice, it shows up here."}
            </EmptyState>
          </div>
        ) : (
          <PostList handle={handle} posts={posts} canPin={ctx.perms.manage_club} />
        )}
      </div>

      <aside className="flex flex-col gap-6 px-4 py-6">
        {latest ? (
          <div>
            <span className="label-caps">Latest album</span>
            <Link href={`/c/${handle}/a/${latest.id}`} className="mt-2 block text-ink no-underline">
              {latest.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={latest.coverUrl} alt="" className="aspect-[4/3] w-full rounded-[var(--soft-r-sm)] object-cover" />
              ) : (
                <span className="block aspect-[4/3] w-full rounded-[var(--soft-r-sm)] bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))]" />
              )}
              <span className="mt-2 block font-heading text-[16px] font-bold">{latest.title}</span>
              <span className="block text-[14px] text-ink-70">
                {latest.photoCount} photos · {latest.videoCount} videos
              </span>
            </Link>
          </div>
        ) : null}

        {committeeList.length ? (
          <div className="border-t-2 border-divider pt-4">
            <span className="label-caps">Committee</span>
            <div className="mt-2 flex flex-col gap-2">
              {committeeList.map((m) => (
                <span key={m.id} className="text-[14px]">
                  {personName({ displayName: m.users?.display_name, claimedName: m.claimed_name, rosterName: m.roster_name })}{" "}
                  <span className="text-[14px] text-ink-55">{m.club_roles.name}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <p className="border-t-2 border-divider pt-4 text-[14px] text-ink-70">
          Comments are visible to every member of the club. Admins can remove any comment.
        </p>
      </aside>
    </main>
  );
}

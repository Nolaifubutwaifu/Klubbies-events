import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoStackArt } from "@/components/soft/illustrations";
import { getClubContext } from "@/lib/auth/session";
import { listFavourites } from "@/lib/media/favourites";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { SavedTabs, type DownloadedItem } from "./SavedTabs";

export async function generateMetadata(props: PageProps<"/c/[handle]/saved">): Promise<Metadata> {
  const { handle } = await props.params;
  const ctx = await getClubContext(handle);
  return { title: ctx ? `Saved · ${ctx.club.name}` : "Saved" };
}

export default async function SavedPage(props: PageProps<"/c/[handle]/saved">) {
  const { handle } = await props.params;
  const ctx = await getClubContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [groups, { data: events }] = await Promise.all([
    listFavourites(supabase, ctx.club.id, ctx.userId),
    // What this member has already taken away, newest first.
    ctx.membership
      ? supabase
          .from("access_events")
          .select("media_id, occurred_at")
          .eq("club_id", ctx.club.id)
          .eq("membership_id", ctx.membership.id)
          .eq("action", "download")
          .not("media_id", "is", null)
          .order("occurred_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] }),
  ]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  const downloadedIds = [...new Set((events ?? []).map((e) => e.media_id).filter((id): id is string => Boolean(id)))];
  const { data: downloadedMedia } = downloadedIds.length
    ? await supabase
        .from("media")
        .select("id, album_id, thumb_path, poster_path, albums(title)")
        .in("id", downloadedIds)
        .eq("status", "ready")
    : { data: [] };

  const downloadUrls = await signPaths(
    supabase,
    (downloadedMedia ?? []).map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );
  const whenByMedia = new Map((events ?? []).map((e) => [e.media_id, e.occurred_at]));
  const downloads: DownloadedItem[] = (downloadedMedia ?? []).map((m) => ({
    id: m.id,
    albumId: m.album_id,
    albumTitle: m.albums?.title ?? "This club",
    thumbUrl: downloadUrls.get(m.thumb_path ?? m.poster_path ?? "") ?? null,
    at: whenByMedia.get(m.id) ?? "",
  }));

  return (
    <main className="flex flex-1 flex-col">
      <section>
        <div className="w-full px-4 pb-16 pt-6 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="soft-chip">{ctx.club.name}</span>
              <h1 className="mt-3 text-[clamp(30px,4.5vw,44px)]">Saved</h1>
              <p className="mt-2 text-[15px] text-[color:var(--ink-70)]">
                The good ones, kept in one place.
              </p>
            </div>
          </div>

          {total === 0 && downloads.length === 0 ? (
            <div className="soft-card mt-8 flex flex-col items-start gap-3 p-8">
              <span className="text-accent-400">
                <PhotoStackArt size={120} />
              </span>
              <h2 className="text-[24px]">No favourites yet.</h2>
              <p className="m-0 max-w-[46ch] text-[15px] text-[color:var(--ink-70)]">
                Open any photo and hit Favourite. It turns up here at full quality, ready to download.
              </p>
              <Link href={`/c/${handle}`} className="soft-btn soft-btn-primary no-underline">
                Browse the albums
              </Link>
              <p className="m-0 text-[14px] text-[color:var(--ink-55)]">
                Statistically, you&rsquo;re in some of them.
              </p>
            </div>
          ) : (
            <SavedTabs handle={handle} groups={groups} downloads={downloads} />
          )}
        </div>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventContext } from "@/lib/auth/session";
import { listFavourites } from "@/lib/media/favourites";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { SavedTabs, type DownloadedItem } from "./SavedTabs";

export async function generateMetadata(props: PageProps<"/e/[handle]/saved">): Promise<Metadata> {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  return { title: ctx ? `Saved · ${ctx.event.name}` : "Saved" };
}

export default async function SavedPage(props: PageProps<"/e/[handle]/saved">) {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [groups, { data: downloadEvents }] = await Promise.all([
    listFavourites(supabase, ctx.event.id, ctx.userId),
    // What this member has already taken away, newest first.
    ctx.membership
      ? supabase
          .from("access_events")
          .select("media_id, occurred_at")
          .eq("event_id", ctx.event.id)
          .eq("membership_id", ctx.membership.id)
          .eq("action", "download")
          .not("media_id", "is", null)
          .order("occurred_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] }),
  ]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  const downloadedIds = [...new Set((downloadEvents ?? []).map((e) => e.media_id).filter((id): id is string => Boolean(id)))];
  const { data: downloadedMedia } = downloadedIds.length
    ? await supabase
        .from("media")
        .select("id, album_id, thumb_path, poster_path, albums!media_album_id_fkey(title)")
        .in("id", downloadedIds)
        .eq("status", "ready")
    : { data: [] };

  const downloadUrls = await signPaths(
    supabase,
    (downloadedMedia ?? []).map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );
  const whenByMedia = new Map((downloadEvents ?? []).map((e) => [e.media_id, e.occurred_at]));
  const downloads: DownloadedItem[] = (downloadedMedia ?? []).map((m) => ({
    id: m.id,
    albumId: m.album_id,
    albumTitle: m.albums?.title ?? "This event",
    thumbUrl: downloadUrls.get(m.thumb_path ?? m.poster_path ?? "") ?? null,
    at: whenByMedia.get(m.id) ?? "",
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col">
      <section>
        <div className="w-full px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kb-eyebrow">{ctx.event.name}</span>
              <h1 className="serif mt-2 text-[clamp(36px,5vw,56px)]">Saved</h1>
              <p className="mt-2 text-[15px] text-[color:var(--ink-70)]">Your favourites and downloads from this event.</p>
            </div>
          </div>

          {total === 0 && downloads.length === 0 ? (
            <div className="soft-dashed mt-8 flex max-w-[640px] flex-col items-start gap-3 p-7">
              <h2 className="text-[18px] font-semibold">Nothing saved yet</h2>
              <p className="m-0 max-w-[46ch] text-[15px] text-[color:var(--ink-70)]">
                Open any photo and tap Save. It turns up here at full quality, ready to download.
              </p>
              <Link href={`/e/${handle}`} className="btn btn-primary no-underline">
                Browse the albums
              </Link>
            </div>
          ) : (
            <SavedTabs handle={handle} groups={groups} downloads={downloads} />
          )}
        </div>
      </section>
    </main>
  );
}

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { ZipParts } from "@/components/ZipParts";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatLongDate, plural } from "@/lib/format";
import { listStackedAlbums } from "@/lib/media/album-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Download everything" };

/**
 * Every album as zips, every part listed. The pre-deletion email links here,
 * so an organiser's last chance to keep their photos gets all of them, not
 * the first 150 of each album.
 */
export default async function ExportPage(props: PageProps<"/admin/[handle]/export">) {
  const { handle } = await props.params;
  const { event } = await requireAdminContext(handle);
  const supabase = await createClient();

  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, album_date")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("sort_order")
    .order("created_at");
  // Counted per album: a plain select stops at 1,000 rows.
  const counts = new Map<string, number>(
    await Promise.all(
      (albums ?? []).map(async (album) => {
        const { count } = await supabase
          .from("media")
          .select("id", { count: "exact", head: true })
          .eq("album_id", album.id)
          .eq("status", "ready");
        return [album.id, count ?? 0] as const;
      }),
    ),
  );
  const listed = albums ?? [];
  const covers = new Map((await listStackedAlbums(supabase, event.id, { includeDrafts: true })).map((album) => [album.id, album.coverUrl]));
  const total = listed.reduce((sum, album) => sum + (counts.get(album.id) ?? 0), 0);

  return (
    <div className="flex max-w-[920px] flex-col gap-6">
      <PageTitle kicker={event.name} title="Download everything">
        Every album as a zip of the original files. Large albums come in parts so each download stays manageable.
        {event.photos_delete_at ? ` Photos and videos are kept until ${formatLongDate(event.photos_delete_at)}.` : ""}
      </PageTitle>

      {listed.length === 0 ? (
        <p className="m-0 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 text-[15px]">There&apos;s nothing to download yet.</p>
      ) : (
        <section aria-label="Albums to download" className="overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--kb-sand)] bg-[#fafaf8] px-5 py-3 text-[14px]">
            <span className="font-semibold">{plural(listed.length, "album")}</span>
            <span className="mono text-[color:var(--kb-ink-3)]">{plural(total, "file")}</span>
          </div>
          {listed.map((album) => {
            const count = counts.get(album.id) ?? 0;
            const cover = covers.get(album.id);
            return (
              <div key={album.id} id={`album-${album.id}`} className="flex flex-wrap items-center gap-4 border-t border-[color:var(--kb-sand)] px-5 py-3.5 first-of-type:border-t-0">
                <span className="block h-11 w-11 flex-none overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                  <span className="font-medium">{album.title}</span>
                  <span className={count ? "mono text-[14px] text-[color:var(--kb-ink-3)]" : "text-[14px] text-[color:var(--kb-ink-3)]"}>
                    {count ? plural(count, "file") : "Nothing to download yet"}
                  </span>
                </span>
                {count ? <ZipParts href={`/api/albums/${album.id}/zip`} count={count} label="Download zip" className="btn btn-secondary btn-sm no-underline" /> : null}
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5">
        <span className="flex flex-col">
          <span className="font-semibold">Not ready to let them go?</span>
          <span className="text-[14px] text-[color:var(--kb-ink-2)]">Keep every photo and the gallery for another 12 months.</span>
        </span>
        <Link href={`/admin/${event.handle}/billing#keep`} className="btn btn-primary no-underline">
          Keep everything for another year
        </Link>
      </section>
    </div>
  );
}

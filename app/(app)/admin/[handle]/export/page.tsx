import type { Metadata } from "next";
import Link from "next/link";
import { ZipParts } from "@/components/ZipParts";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatLongDate, plural } from "@/lib/format";
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
  const listed = (albums ?? []).filter((album) => (counts.get(album.id) ?? 0) > 0);
  const total = listed.reduce((sum, album) => sum + (counts.get(album.id) ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle kicker={event.name} title="Download everything">
        {event.photos_delete_at
          ? `Photos and videos are kept until ${formatLongDate(event.photos_delete_at)}. `
          : null}
        Each zip holds up to 150 files, so bigger albums come in numbered parts. Download every part to keep the lot.
      </PageTitle>

      {listed.length === 0 ? (
        <p className="soft-card m-0 p-5 text-[15px]">There&apos;s nothing to download yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {listed.map((album) => {
            const count = counts.get(album.id) ?? 0;
            return (
              <li key={album.id} id={`album-${album.id}`} className="soft-card flex flex-col gap-3 p-5">
                <div>
                  <h2 className="m-0 text-[17px] font-semibold">{album.title}</h2>
                  <p className="m-0 text-[14px] text-[color:var(--ink-55)]">
                    {album.album_date ? `${formatLongDate(album.album_date)} · ` : ""}
                    {plural(count, "file")}
                  </p>
                </div>
                <ZipParts href={`/api/albums/${album.id}/zip`} count={count} label="Download zip" />
              </li>
            );
          })}
        </ul>
      )}

      <p className="m-0 text-[14px] text-[color:var(--ink-55)]">
        {plural(total, "file")} in {plural(listed.length, "album")}.{" "}
        <Link href={`/admin/${event.handle}/billing#keep`}>Keep everything for another year</Link> instead.
      </p>
    </div>
  );
}

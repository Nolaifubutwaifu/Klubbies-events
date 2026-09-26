import type { Metadata } from "next";
import Link from "next/link";
import { MoreLink, MoreMenu } from "@/components/MoreMenu";
import { BillingGate } from "@/components/BillingGate";
import { EmptyState, PageTitle } from "@/components/ui";
import { PhotoStackArt } from "@/components/soft/illustrations";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { listStackedAlbums } from "@/lib/media/album-list";
import { createClient } from "@/lib/supabase/server";
import { AlbumManager, type AlbumStats } from "./AlbumManager";

export const metadata: Metadata = { title: "Albums" };

export default async function AdminAlbumsPage(props: PageProps<"/admin/[handle]/albums">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const [albums, { data: engagement }] = await Promise.all([
    listStackedAlbums(supabase, ctx.club.id, { includeDrafts: true }),
    supabase.from("album_engagement").select("*").eq("club_id", ctx.club.id),
  ]);

  const stats: Record<string, AlbumStats> = {};
  for (const row of engagement ?? []) {
    if (!row.album_id) continue;
    stats[row.album_id] = {
      views: row.view_count ?? 0,
      downloads: row.download_count ?? 0,
      members: row.member_count ?? 0,
    };
  }

  const live = albums.filter((a) => a.status === "published").length;
  const drafts = albums.filter((a) => a.status === "draft" && !a.publishAt).length;
  const scheduled = albums.filter((a) => a.status === "draft" && a.publishAt).length;
  const hidden = albums.filter((a) => a.status === "hidden").length;
  const summary = [
    `${live} live`,
    drafts ? `${drafts} draft` : null,
    scheduled ? `${scheduled} scheduled` : null,
    hidden ? `${hidden} hidden` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="flex flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle kicker={ctx.club.name} title="Albums">
          {albums.length ? `${summary}. Drag to reorder what members see first.` : "Nothing here yet."}
        </PageTitle>
        <div className="flex items-center gap-2">
          <Link href={`/admin/${handle}/upload`} className="btn btn-primary">
            New album
          </Link>
          <MoreMenu iconOnly label="More actions">
            <MoreLink href={`/c/${handle}`}>See it as a member</MoreLink>
            <MoreLink href={`/admin/${handle}/guests`}>Make a guest upload link</MoreLink>
          </MoreMenu>
        </div>
      </div>

      {canWrite(ctx.club.billing_status) ? null : <BillingGate handle={handle} action="create albums" />}

      {albums.length ? (
        <AlbumManager clubId={ctx.club.id} handle={handle} albums={albums} stats={stats} />
      ) : (
        <EmptyState
          title="No albums yet."
          art={<PhotoStackArt size={120} />}
          action={
            <Link href={`/admin/${handle}/upload`} className="btn btn-primary">
              Make the first one
            </Link>
          }
        >
          Even last year&apos;s photos will do. Members land on this list, so one album is better than none.
        </EmptyState>
      )}
    </main>
  );
}

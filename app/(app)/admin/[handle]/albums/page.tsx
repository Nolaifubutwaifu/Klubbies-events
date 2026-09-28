import type { Metadata } from "next";
import Link from "next/link";
import { MoreLink, MoreMenu } from "@/components/MoreMenu";
import { BillingGate } from "@/components/BillingGate";
import { DeletedUndo } from "@/components/DeletedUndo";
import { EmptyState, PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { listStackedAlbums } from "@/lib/media/album-list";
import { recentlyDeleted } from "@/lib/media/bin";
import { createClient } from "@/lib/supabase/server";
import { AlbumManager, type AlbumStats } from "./AlbumManager";

export const metadata: Metadata = { title: "Albums" };

export default async function AdminAlbumsPage(props: PageProps<"/admin/[handle]/albums">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const { deleted } = await props.searchParams;
  const [albums, { data: engagement }, justDeleted] = await Promise.all([
    listStackedAlbums(supabase, ctx.event.id, { includeDrafts: true }),
    supabase.from("album_engagement").select("*").eq("event_id", ctx.event.id),
    recentlyDeleted("albums", deleted, ctx.event.id),
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
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle kicker={ctx.event.name} title="Albums">
          {albums.length ? `${summary}. Drag to reorder what attendees see first.` : "Nothing here yet."}
        </PageTitle>
        <div className="flex items-center gap-2">
          <Link href={`/admin/${handle}/upload`} className="btn btn-primary">
            New album
          </Link>
          <MoreMenu iconOnly label="More actions">
            <MoreLink href={`/e/${handle}`}>See it as an attendee</MoreLink>
            <MoreLink href={`/admin/${handle}/photographers`}>Make a guest upload link</MoreLink>
            <MoreLink href={`/admin/${handle}/settings/deleted`}>Recently deleted</MoreLink>
          </MoreMenu>
        </div>
      </div>

      {canWrite(ctx.event.billing_status) ? null : <BillingGate handle={handle} action="create albums" />}

      {albums.length ? (
        <AlbumManager eventId={ctx.event.id} handle={handle} albums={albums} stats={stats} />
      ) : (
        <EmptyState
          title="No albums yet."
         
          action={
            <Link href={`/admin/${handle}/upload`} className="btn btn-primary">
              Make the first one
            </Link>
          }
        >
          Create one per part of the event, then add your photographers.
        </EmptyState>
      )}

      {justDeleted ? <DeletedUndo kind="album" id={justDeleted.id} name={justDeleted.name} /> : null}
    </main>
  );
}

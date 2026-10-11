import { publishAllDraftsAction } from "@/app/(app)/admin/actions";
import { SubmitButton } from "@/components/forms";
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

  const drafts = albums.filter((a) => a.status === "draft" && !a.publishAt).length;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle kicker={ctx.event.name} title="Albums">
          {albums.length
            ? "One album per part of the event works best. Attendees see albums once they're published."
            : "Nothing here yet."}
        </PageTitle>
        <div className="flex flex-wrap items-center gap-2">
          {drafts > 1 ? (
            <form action={publishAllDraftsAction.bind(null, ctx.event.id)}>
              <SubmitButton className="btn btn-secondary" pendingText="Publishing…">
                Publish all {drafts} drafts
              </SubmitButton>
            </form>
          ) : null}
          <Link href={`/admin/${handle}/upload`} className="btn btn-primary no-underline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New album
          </Link>
          <MoreMenu iconOnly label="More actions">
            <MoreLink href={`/e/${handle}`}>See it as an attendee</MoreLink>
            <MoreLink href={`/admin/${handle}/photographers`}>Make a guest upload link</MoreLink>
            <MoreLink href={`/admin/${handle}/settings/deleted`}>Recently deleted</MoreLink>
          </MoreMenu>
        </div>
      </div>

      {canWrite(ctx.event) ? null : <BillingGate handle={handle} action="create albums" deletedAt={ctx.event.photos_deleted_at} />}

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

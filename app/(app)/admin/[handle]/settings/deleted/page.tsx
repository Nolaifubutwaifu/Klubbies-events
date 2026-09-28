import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { personName } from "@/lib/auth/display-name";
import { formatDate } from "@/lib/format";
import { restorableUntil } from "@/lib/media/bin";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BinView, type BinAlbum, type BinItem } from "./BinView";

export const metadata: Metadata = { title: "Recently deleted" };

/**
 * Settings → Recently deleted. Binned rows are invisible to every user client
 * (migration 26), so they are read with the service role here, after
 * requireAdminContext has established the viewer runs this event.
 */
export default async function RecentlyDeletedPage(props: PageProps<"/admin/[handle]/settings/deleted">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const admin = createAdminClient();
  const eventId = ctx.event.id;

  const [{ data: albums }, { data: media }] = await Promise.all([
    admin
      .from("albums")
      .select("id, title, deleted_at, deleted_by")
      .eq("event_id", eventId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    admin
      .from("media")
      .select("id, kind, thumb_path, poster_path, deleted_at, deleted_by, albums!media_album_id_fkey!inner(title, deleted_at)")
      .eq("event_id", eventId)
      .not("deleted_at", "is", null)
      .is("albums.deleted_at", null)
      .order("deleted_at", { ascending: false })
      .limit(500),
  ]);

  const binnedAlbums = albums ?? [];
  const counts = await Promise.all(
    binnedAlbums.map((a) =>
      admin
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("album_id", a.id)
        .eq("deleted_at", a.deleted_at as string),
    ),
  );

  const deleterIds = [
    ...new Set([...binnedAlbums, ...(media ?? [])].map((r) => r.deleted_by).filter((id): id is string => Boolean(id))),
  ];
  const { data: deleters } = deleterIds.length
    ? await admin
        .from("memberships")
        .select("user_id, roster_name, claimed_name, users!memberships_user_id_fkey(display_name)")
        .eq("event_id", eventId)
        .in("user_id", deleterIds)
    : { data: [] };
  const nameOf = new Map(
    (deleters ?? []).map((m) => [
      m.user_id,
      personName({ displayName: m.users?.display_name, claimedName: m.claimed_name, rosterName: m.roster_name }),
    ]),
  );

  // Organisers manage albums, so the storage policy lets their own client sign
  // any file in the event, binned ones included.
  const supabase = await createClient();
  const urls = await signPaths(
    supabase,
    (media ?? []).map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );

  const albumRows: BinAlbum[] = binnedAlbums.map((a, i) => ({
    id: a.id,
    title: a.title,
    count: counts[i].count ?? 0,
    deletedOn: formatDate(a.deleted_at),
    deletedBy: (a.deleted_by && nameOf.get(a.deleted_by)) || null,
    restoreBy: formatDate(restorableUntil(a.deleted_at as string)),
  }));
  const items: BinItem[] = (media ?? []).map((m) => {
    const path = m.thumb_path ?? m.poster_path;
    return {
      id: m.id,
      kind: m.kind,
      thumbUrl: path ? (urls.get(path) ?? null) : null,
      albumTitle: m.albums?.title ?? "",
      deletedOn: formatDate(m.deleted_at),
      deletedBy: (m.deleted_by && nameOf.get(m.deleted_by)) || null,
      restoreBy: formatDate(restorableUntil(m.deleted_at as string)),
    };
  });

  return (
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={ctx.event.name} title="Recently deleted">
        Albums, photos and videos you deleted stay here for 30 days, hidden from attendees, then they&apos;re deleted for
        good.
      </PageTitle>
      <Link href={`/admin/${handle}/settings`} className="self-start text-[14px]">
        Back to Settings
      </Link>

      {albumRows.length === 0 && items.length === 0 ? (
        <EmptyState title="Nothing deleted recently.">Anything you delete in the next 30 days can be restored from here.</EmptyState>
      ) : (
        <BinView eventId={eventId} albums={albumRows} items={items} />
      )}
    </main>
  );
}

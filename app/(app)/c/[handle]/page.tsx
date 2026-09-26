import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaceNotice } from "@/components/FaceNotice";
import { FacePrompt } from "@/components/FacePrompt";
import { MarkVisited } from "@/components/MarkVisited";
import { SoftEvents } from "@/components/soft/SoftEvents";
import { getClubContext, getProfile } from "@/lib/auth/session";
import { displayNameFor } from "@/lib/auth/display-name";
import { countPhotosOfYouByAlbum, faceStateFor } from "@/lib/faces/queries";
import { listStackedAlbums } from "@/lib/media/album-list";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(props: PageProps<"/c/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  const ctx = await getClubContext(handle);
  return { title: ctx?.club.name ?? "Club" };
}

export default async function ClubFeedPage(props: PageProps<"/c/[handle]">) {
  const { handle } = await props.params;
  const ctx = await getClubContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [albums, displayName, profile, faceState] = await Promise.all([
    listStackedAlbums(supabase, ctx.club.id, {
      includeDrafts: ctx.perms.manage_albums,
      since: ctx.membership?.last_seen_at ?? null,
    }),
    displayNameFor(ctx),
    getProfile(),
    faceStateFor(supabase, ctx.club.id, ctx.userId),
  ]);

  // Only worth counting once someone has actually enrolled.
  const photosOfYou =
    faceState.profile?.status === "ready"
      ? await countPhotosOfYouByAlbum(
          supabase,
          ctx.club.id,
          albums.map((album) => album.id),
        )
      : new Map<string, number>();

  return (
    <main className="flex flex-1 flex-col">
      {/* Told first, invited second. A member who has not acknowledged the
          notice sees only that; the enrol prompt waits its turn. */}
      {faceState.enabled && !ctx.membership?.face_notice_ack_at ? (
        <FaceNotice clubId={ctx.club.id} meHref={`/c/${handle}/me`} />
      ) : faceState.enabled && !faceState.profile ? (
        <FacePrompt clubId={ctx.club.id} href={`/c/${handle}/me`} count={0} />
      ) : null}
      <SoftEvents
        albums={albums}
        hrefBase={`/c/${handle}/a`}
        canManage={ctx.perms.manage_albums}
        clubName={ctx.club.name}
        newAlbumHref={`/admin/${handle}/upload`}
        firstName={displayName.trim().split(/\s+/)[0] ?? ""}
        notifiesOnNewAlbums={profile?.notify_new_album ?? false}
        photosOfYou={photosOfYou}
      />
      {/* Stamps the visit after render, so this page still shows what was new. */}
      <MarkVisited clubId={ctx.club.id} />
    </main>
  );
}

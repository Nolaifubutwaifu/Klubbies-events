import { notFound } from "next/navigation";
import { z } from "zod";
import { Uploader } from "@/app/(app)/admin/[handle]/albums/[albumId]/Uploader";
import { AlbumEditPanel } from "@/components/AlbumEditPanel";
import { AlbumGrid } from "@/components/AlbumGrid";
import { AlbumActions } from "@/components/AlbumActions";
import { UnfinishedUploads } from "@/components/UnfinishedUploads";
import { getEventContext } from "@/lib/auth/session";
import { faceStateFor, photosOfYouInAlbum } from "@/lib/faces/queries";
import { formatDate } from "@/lib/format";
import { favouritedIds } from "@/lib/media/favourites";
import { listAlbumMedia } from "@/lib/media/queries";
import { ProcessingBanner } from "@/components/ProcessingBanner";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/auth/display-name";
import { stuckCutoffIso } from "@/lib/media/constants";

/** The album, for anyone allowed to open it: published, or any state for organisers. */
export async function loadAlbum(handle: string, albumId: string) {
  if (!z.uuid().safeParse(albumId).success) return null;
  const ctx = await getEventContext(handle);
  if (!ctx) return null;
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("*").eq("id", albumId).eq("event_id", ctx.event.id).maybeSingle();
  if (!album) return null;
  if (album.status !== "published" && !ctx.perms.manage_albums) return null;
  return { ctx, album, supabase, handle };
}

/**
 * One album: its heading, actions, the upload and edit panels, and the grid.
 * Attendees see it in the event (/e/[handle]/a/[id]); organisers see the same
 * screen inside the organiser layout (/admin/[handle]/albums/[id]), with the
 * album's figures and its settings folded into a card.
 */
export async function AlbumScreen({
  handle: rawHandle,
  albumId,
  search,
  organiser = false,
}: {
  handle: string;
  albumId: string;
  search: Record<string, string | string[] | undefined>;
  organiser?: boolean;
}) {
  const data = await loadAlbum(rawHandle, albumId);
  if (!data) notFound();
  const { ctx, album, supabase, handle } = data;

  const canManage = ctx.perms.manage_albums;
  const canAdd = canManage || ctx.perms.upload || (album.contributor_scope === "members" && Boolean(ctx.membership));
  const editing = canManage && search.edit === "1";
  const adding = canAdd && search.add === "1";
  const albumHref = organiser ? `/admin/${handle}/albums/${album.id}` : `/e/${handle}/a/${album.id}`;
  // Photos always open in the attendee viewer.
  const viewerBase = `/e/${handle}/a/${album.id}`;

  // The page needs about a dozen reads. Most don't depend on each other, so
  // they start together and the page waits for two rounds rather than eight.
  const firstPage = Promise.all([
    listAlbumMedia(supabase, album.id, 0, { includeProcessing: canManage }),
    supabase.from("album_media_counts").select("*").eq("album_id", album.id).maybeSingle(),
    canManage
      ? supabase
          .from("media")
          .select("id, original_filename, created_at, status")
          .eq("album_id", album.id)
          .neq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase
      .from("media")
      .select("id")
      .eq("album_id", album.id)
      .eq("status", "ready")
      .order("sort_at", { ascending: true })
      .limit(240),
  ]);

  // "Added by Mahi and 1 guest" — who put the night together, which is the
  // line the design leads the album with.
  const uploadersQuery = supabase.from("media").select("uploaded_by").eq("album_id", album.id).not("uploaded_by", "is", null).limit(400);
  const guestFilesQuery = supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id)
    .not("guest_link_id", "is", null);
  // The credit line: who took these. Set from the photographer's upload link
  // or the uploader's name when each file arrived.
  const creditsQuery = supabase
    .from("media")
    .select("photographer_name")
    .eq("album_id", album.id)
    .not("photographer_name", "is", null)
    .limit(1000);

  // Members can't read an unfinished row, so the count comes from the service
  // role — after the membership check above, never before it. It's a tally of
  // files in an album they can already open, and no more than that.
  const processing = (async () => {
    let photos = 0;
    let videos = 0;
    if (!canManage && ctx.membership) {
      const { data: pending } = await createAdminClient()
        .from("media")
        .select("kind")
        .eq("album_id", album.id)
        .eq("status", "processing")
        // Only uploads still moving: one that stopped isn't coming in "2 to 5
        // minutes", and the organiser is told attendees can't see it.
        .gt("updated_at", stuckCutoffIso())
        .is("hidden_at", null)
        .is("deleted_at", null)
        .limit(200);
      for (const row of pending ?? []) {
        if (row.kind === "video") videos += 1;
        else photos += 1;
      }
    }
    return { photos, videos };
  })();

  // A cover the committee chose. Without one the first photo stands in, which
  // needs the first page, so that fallback is applied further down.
  const chosenCover = (async (): Promise<{ url: string | null; source: string } | null> => {
    if (album.cover_path) {
      const url = (await signPaths(supabase, [album.cover_path], SIGNED_URL_TTL.display)).get(album.cover_path) ?? null;
      return { url, source: "Your own cover image." };
    }
    if (album.cover_media_id) {
      const { data: cover } = await supabase
        .from("media")
        .select("display_path, thumb_path")
        .eq("id", album.cover_media_id)
        .maybeSingle();
      const path = cover?.display_path ?? cover?.thumb_path;
      const url = path ? ((await signPaths(supabase, [path], SIGNED_URL_TTL.display)).get(path) ?? null) : null;
      return { url, source: "Chosen from this album." };
    }
    return null;
  })();

  // "You (6)" beside All, for a member who has enrolled and is in this album.
  // Fetched as its own list rather than filtered from the loaded page, so it
  // finds you on page three as well as page one.
  const mine = (async () => {
    const faceState = await faceStateFor(supabase, ctx.event.id, ctx.userId);
    const mineIds = faceState.enabled && faceState.profile?.status === "ready" ? await photosOfYouInAlbum(supabase, album.id) : [];
    return (await listAlbumMedia(supabase, album.id, 0, { onlyIds: mineIds.slice(0, 200) })).items;
  })();

  const [
    [{ items, hasMore }, { data: counts }, { data: unfinished }, { data: readyIds }],
    { data: uploaders },
    { count: guestFiles },
    { photos: processingPhotos, videos: processingVideos },
    cover,
    mineItems,
    { data: creditRows },
  ] = await Promise.all([firstPage, uploadersQuery, guestFilesQuery, processing, chosenCover, mine, creditsQuery]);
  const credits = [...new Set((creditRows ?? []).map((row) => row.photographer_name?.trim()).filter((n): n is string => Boolean(n)))];

  const uploaderIds = [...new Set((uploaders ?? []).map((m) => m.uploaded_by).filter((id): id is string => Boolean(id)))];
  const [{ count: savedTotal }, savedIds, { data: uploaderNames }] = await Promise.all([
    supabase
      .from("favourites")
      .select("media_id", { count: "exact", head: true })
      .eq("event_id", ctx.event.id)
      .eq("user_id", ctx.userId)
      .in("media_id", (readyIds ?? []).map((m) => m.id)),
    favouritedIds(supabase, ctx.userId, items.map((item) => item.id)),
    uploaderIds.length
      ? supabase
          .from("memberships")
          .select("user_id, roster_name, claimed_name, users!memberships_user_id_fkey(display_name)")
          .eq("event_id", ctx.event.id)
          .in("user_id", uploaderIds.slice(0, 10))
      : Promise.resolve({ data: [] }),
  ]);

  const firstNames = (uploaderNames ?? [])
    .map((m) => personName({ displayName: m.users?.display_name, claimedName: m.claimed_name, rosterName: m.roster_name }).split(/\s+/)[0])
    .filter(Boolean);
  const guestCount = guestFiles ?? 0;
  const addedBy = [
    firstNames.length === 1
      ? firstNames[0]
      : firstNames.length > 1
        ? `${firstNames.slice(0, 2).join(" and ")}${firstNames.length > 2 ? ` +${firstNames.length - 2}` : ""}`
        : null,
    guestCount > 0 ? "a photographer" : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const coverUrl = cover ? cover.url : (items[0]?.thumbUrl ?? null);
  const coverSource = cover?.source ?? "The first photo in the album is used until you choose one.";

  const photoCount = counts?.photo_count ?? 0;
  const videoCount = counts?.video_count ?? 0;
  // Organisers see how the album is doing.
  const engagement = organiser
    ? (await supabase.from("album_engagement").select("view_count, download_count").eq("album_id", album.id).maybeSingle()).data
    : null;
  const pad = organiser ? "" : "px-5 sm:px-10";
  const albumPanel = (
    <AlbumEditPanel
      album={{
        id: album.id,
        eventId: album.event_id,
        title: album.title,
        albumDate: album.album_date,
        description: album.description,
        allowDownload: album.allow_download,
        visibility: album.visibility,
        contributorScope: album.contributor_scope,
        coverUrl,
        coverSource,
      }}
      closeHref={albumHref}
      onPickCover={`${albumHref}?pickCover=1`}
    />
  );

  return (
    <main className={`mx-auto flex w-full flex-1 flex-col gap-[18px] ${organiser ? "" : "max-w-[1320px] pb-6"}`}>
      {/* The album's title block. The event bar above carries Back. */}
      <div className={`flex flex-col gap-[18px] ${organiser ? "" : "pt-6"}`}>
        <div className={`flex flex-col gap-1.5 ${pad}`}>
          {organiser ? (
            <a href={`/admin/${handle}/albums`} className="self-start text-[14px] font-medium">
              All albums
            </a>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className={organiser ? "text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]" : "serif text-[44px] leading-none"}>{album.title}</h1>
            {canManage ? (
              <span
                className={`kb-chip ${album.status === "published" ? "bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]" : "bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]"}`}
              >
                {album.status === "published" ? "Published" : "Draft · attendees can't see it"}
              </span>
            ) : null}
          </div>
          <p className="text-[15px] text-[color:var(--kb-ink-2)]">
            {[
              photoCount ? (
                <span key="p">
                  <span className="mono">{photoCount.toLocaleString("en-AU")}</span> {photoCount === 1 ? "photo" : "photos"}
                </span>
              ) : null,
              videoCount ? (
                <span key="v">
                  <span className="mono">{videoCount.toLocaleString("en-AU")}</span> {videoCount === 1 ? "video" : "videos"}
                </span>
              ) : null,
              engagement ? (
                <span key="views">
                  <span className="mono">{(engagement.view_count ?? 0).toLocaleString("en-AU")}</span> views
                </span>
              ) : null,
              engagement ? (
                <span key="dl">
                  <span className="mono">{(engagement.download_count ?? 0).toLocaleString("en-AU")}</span> downloads
                </span>
              ) : null,
              !organiser && album.album_date ? <span key="d">{formatDate(album.album_date)}</span> : null,
              credits.length ? (
                <span key="c">by {listNames(credits)}</span>
              ) : addedBy ? (
                <span key="a">added by {addedBy}</span>
              ) : null,
            ]
              .filter(Boolean)
              .flatMap((part, i) => (i === 0 ? [part] : [<span key={`s${i}`}> · </span>, part]))}
          </p>
        </div>

        <div className={`flex ${pad}`}>
          <AlbumActions
            albumId={album.id}
            mediaIds={(readyIds ?? []).map((m) => m.id)}
            parts={Math.max(1, Math.ceil((photoCount + videoCount) / 150))}
            canDownload={album.allow_download || canManage}
            canManage={canManage}
            canAdd={canAdd}
            published={album.status === "published"}
            albumHref={albumHref}
            editing={editing}
            adding={adding}
          />
        </div>
      </div>

      {album.description ? (
        <div className={`w-full ${pad}`}>
          <p className="max-w-[60ch] text-[15px] leading-normal text-[color:var(--ink-70)]">{album.description}</p>
        </div>
      ) : null}

      {album.contributor_scope === "members" && !canManage && ctx.membership ? (
        <div className="kb-info mx-5 sm:mx-10">Attendees can add their own photos to this album. Yours appear straight away.</div>
      ) : null}

      {canManage && unfinished?.length ? <UnfinishedUploads items={unfinished} addHref={`${albumHref}?add=1`} /> : null}

      <ProcessingBanner photos={processingPhotos} videos={processingVideos} />

      {adding ? (
        <div className="border-b border-[color:var(--kb-line)] px-4 py-5 sm:px-6 sm:py-8">
          <Uploader albumId={album.id} albumTitle={album.title} />
        </div>
      ) : null}

      {organiser ? (
        <details open={editing || undefined} className="group overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
          <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-4 px-5 [&::-webkit-details-marker]:hidden">
            <span className="text-[16px] font-semibold">Album settings</span>
            <span className="ml-auto hidden truncate text-[14px] text-[color:var(--kb-ink-3)] sm:block">
              {[
                album.album_date ? formatDate(album.album_date) : null,
                album.allow_download ? "Downloads on" : "Downloads off",
                album.contributor_scope === "members" ? "Attendees can add" : "Attendees can't add",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none text-[color:var(--kb-ink-3)] transition-transform group-open:rotate-180 max-sm:ml-auto">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="border-t border-[color:var(--kb-sand)]">{albumPanel}</div>
        </details>
      ) : editing ? (
        albumPanel
      ) : null}

      <AlbumGrid
        // Keyed on the album, not the item count: a delete changes the count,
        // which remounted the grid and took the 10 second Undo with it.
        key={`${album.id}-${album.cover_media_id ?? album.cover_path ?? ""}`}
        albumId={album.id}
        hrefBase={viewerBase}
        inset={!organiser}
        initialItems={items}
        initialHasMore={hasMore}
        coverMediaId={album.cover_media_id}
        canManage={canManage}
        selectMode={search.pickCover === "1"}
        photoCount={photoCount}
        videoCount={videoCount}
        savedIds={[...savedIds]}
        savedTotal={savedTotal ?? savedIds.size}
        processingCount={processingPhotos + processingVideos}
        canDownload={album.allow_download || canManage}
        mineItems={mineItems}
        albumTitle={album.title}
      />
    </main>
  );
}

/** "Priya Shah", "Priya Shah and Tom Reid", "Priya Shah, Tom Reid and 2 others". */
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

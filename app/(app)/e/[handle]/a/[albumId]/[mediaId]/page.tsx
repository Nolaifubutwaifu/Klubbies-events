import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getEventContext } from "@/lib/auth/session";
import { formatBytes, formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { matchForMedia, photosOfYouSequence } from "@/lib/faces/queries";
import { logAccess } from "@/lib/media/access";
import { favouritedIds } from "@/lib/media/favourites";
import { getViewerData } from "@/lib/media/queries";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { Viewer } from "./Viewer";

export const metadata: Metadata = { title: "Viewer" };
// The viewer's near-black, so the browser bar (and the iPhone app's safe
// areas) match it instead of framing the photo in paper white.
export const viewport: Viewport = { themeColor: "#14100f" };

export default async function ViewerPage(props: PageProps<"/e/[handle]/a/[albumId]/[mediaId]">) {
  const { handle, albumId, mediaId } = await props.params;
  const fromMe = (await props.searchParams).from === "me";
  if (!z.uuid().safeParse(albumId).success || !z.uuid().safeParse(mediaId).success) notFound();

  const ctx = await getEventContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id, title, allow_download, status")
    .eq("id", albumId)
    .eq("event_id", ctx.event.id)
    .maybeSingle();
  if (!album || (album.status !== "published" && !ctx.perms.manage_albums)) notFound();

  const data = await getViewerData(supabase, album.id, mediaId);
  if (!data) notFound();

  // Opened from Your photos: swiping, the strip and Close stay with the
  // caller's own photos instead of dropping them into the whole album.
  let mine: {
    prevId: string | null;
    nextId: string | null;
    position: number;
    total: number;
    strip: { id: string; thumbUrl: string | null; kind: string }[];
    hrefs: Record<string, string>;
  } | null = null;
  if (fromMe) {
    const sequence = await photosOfYouSequence(supabase, ctx.event.id);
    const at = sequence.findIndex((item) => item.mediaId === mediaId);
    if (at >= 0) {
      const nearby = sequence.slice(Math.max(0, at - 12), at + 13);
      const thumbs = await signPaths(
        supabase,
        nearby.map((item) => item.thumbPath ?? "").filter(Boolean),
        SIGNED_URL_TTL.thumb,
      );
      mine = {
        prevId: sequence[at - 1]?.mediaId ?? null,
        nextId: sequence[at + 1]?.mediaId ?? null,
        position: at + 1,
        total: sequence.length,
        strip: nearby.map((item) => ({
          id: item.mediaId,
          kind: item.kind,
          thumbUrl: item.thumbPath ? (thumbs.get(item.thumbPath) ?? null) : null,
        })),
        hrefs: Object.fromEntries(
          [sequence[at - 1], sequence[at + 1], ...nearby]
            .filter((item): item is (typeof sequence)[number] => Boolean(item))
            .map((item) => [item.mediaId, `/e/${handle}/a/${item.albumId}/${item.mediaId}?from=me`]),
        ),
      };
    }
  }

  await logAccess(ctx, data.media.id, "view");
  const [favourites, faceMatch, { data: openRequest }] = await Promise.all([
    favouritedIds(supabase, ctx.userId, [data.media.id]),
    // RLS means this only ever returns the viewer's own match.
    matchForMedia(supabase, data.media.id),
    supabase
      .from("media_removal_requests")
      .select("id")
      .eq("media_id", data.media.id)
      .eq("status", "open")
      .maybeSingle(),
  ]);

  const { media } = data;
  const details = [
    ...(media.photographer_name ? [{ label: "Photographer", value: media.photographer_name }] : []),
    ...(media.captured_at ? [{ label: "Taken", value: formatLongDate(media.captured_at) }] : []),
    { label: "Uploaded", value: formatLongDate(media.created_at) },
    {
      label: "File",
      value: [
        media.width && media.height ? `${media.width} × ${media.height}` : null,
        media.kind === "video" ? formatDuration(media.duration_seconds) : null,
        formatBytes(media.byte_size),
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ];

  return (
    <Viewer
      albumHref={mine ? `/e/${handle}/me` : `/e/${handle}/a/${album.id}`}
      albumTitle={album.title}
      itemHrefBase={`/e/${handle}/a/${album.id}`}
      current={{
        id: media.id,
        kind: media.kind === "video" ? "video" : "photo",
        displayUrl: data.displayUrl,
        videoUrl: data.videoUrl,
        posterUrl: data.posterUrl,
        filename: media.original_filename ?? "",
        width: media.width,
        height: media.height,
        duration: formatDuration(media.duration_seconds),
        takenAt: formatTime(media.captured_at),
        photographer: media.photographer_name,
      }}
      details={details}
      prevId={mine ? mine.prevId : data.prevId}
      nextId={mine ? mine.nextId : data.nextId}
      position={mine ? mine.position : data.position}
      total={mine ? mine.total : data.total}
      strip={mine ? mine.strip : data.strip}
      itemHrefs={mine?.hrefs}
      countNoun={mine ? (mine.total === 1 ? "photo of you" : "photos of you") : undefined}
      canDownload={album.allow_download || ctx.isAdmin}
      favourited={favourites.has(data.media.id)}
      canAskRemoval={ctx.event.allow_removal_requests && Boolean(ctx.membership)}
      alreadyAsked={Boolean(openRequest)}
      faceMatchId={faceMatch?.matchId ?? null}
    />
  );
}

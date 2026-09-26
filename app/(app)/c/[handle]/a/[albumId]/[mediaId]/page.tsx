import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getClubContext } from "@/lib/auth/session";
import { formatBytes, formatDuration, formatLongDate, formatTime } from "@/lib/format";
import { matchForMedia } from "@/lib/faces/queries";
import { logAccess } from "@/lib/media/access";
import { favouritedIds } from "@/lib/media/favourites";
import { getViewerData } from "@/lib/media/queries";
import { createClient } from "@/lib/supabase/server";
import { Viewer } from "./Viewer";

export const metadata: Metadata = { title: "Viewer" };

export default async function ViewerPage(props: PageProps<"/c/[handle]/a/[albumId]/[mediaId]">) {
  const { handle, albumId, mediaId } = await props.params;
  if (!z.uuid().safeParse(albumId).success || !z.uuid().safeParse(mediaId).success) notFound();

  const ctx = await getClubContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id, title, allow_download, status")
    .eq("id", albumId)
    .eq("club_id", ctx.club.id)
    .maybeSingle();
  if (!album || (album.status !== "published" && !ctx.isAdmin)) notFound();

  const data = await getViewerData(supabase, album.id, mediaId);
  if (!data) notFound();

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
    { label: "Taken", value: formatLongDate(media.captured_at) || "Unknown" },
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
      albumHref={`/c/${handle}/a/${album.id}`}
      albumTitle={album.title}
      itemHrefBase={`/c/${handle}/a/${album.id}`}
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
      }}
      details={details}
      prevId={data.prevId}
      nextId={data.nextId}
      position={data.position}
      total={data.total}
      strip={data.strip}
      canDownload={album.allow_download || ctx.isAdmin}
      favourited={favourites.has(data.media.id)}
      canAskRemoval={ctx.club.allow_removal_requests && Boolean(ctx.membership)}
      alreadyAsked={Boolean(openRequest)}
      faceMatchId={faceMatch?.matchId ?? null}
    />
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById, getSessionUser } from "@/lib/auth/session";
import { r2Url } from "@/lib/backup/r2";
import type { EventContext } from "@/lib/auth/session";
import { logDownloads } from "@/lib/media/access";
import { SIGNED_URL_TTL, mediaClaims, signedUrlLifetime, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  mediaIds: z.array(z.uuid()).min(1).max(200),
  // "share" is what Safari's Save to Photos hands the share sheet: the display
  // copy of a photo (always JPEG or WebP, which Photos reads), and the real
  // file of a video. The poster of a video is not the video.
  variant: z.enum(["thumb", "display", "video", "original", "share"]).default("thumb"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await getSessionUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const supabase = await createClient();
  // RLS decides which of the requested items this user may see.
  const { data, error } = await supabase
    .from("media")
    .select("id, kind, storage_path, thumb_path, display_path, poster_path, backed_up_at, mime_type, event_id, album_id, albums!media_album_id_fkey(allow_download)")
    .in("id", parsed.data.mediaIds);
  if (error) return NextResponse.json({ error: "Could not load media" }, { status: 500 });

  const { variant } = parsed.data;
  // Originals are what "Save to Photos" in the app stores. They live as long
  // as video links: the app fetches a batch one file after another. Photos the
  // shipped app can't name correctly (HEIC and the like) get the display copy.
  const savesAsOriginal = (m: NonNullable<typeof data>[number]) =>
    m.kind === "video" || /^image\/(jpeg|png)$/.test(m.mime_type ?? "");
  const pathFor = (m: NonNullable<typeof data>[number]) => {
    if (variant === "original") return savesAsOriginal(m) ? m.storage_path : (m.display_path ?? m.storage_path);
    if (variant === "thumb") return m.thumb_path ?? m.poster_path;
    if (variant === "video") return m.kind === "video" ? m.storage_path : null;
    if (variant === "share") return m.kind === "video" ? m.storage_path : (m.display_path ?? m.storage_path);
    return m.kind === "video" ? m.poster_path : (m.display_path ?? m.storage_path);
  };
  const ttl =
    variant === "video" || variant === "original" || variant === "share"
      ? SIGNED_URL_TTL.video
      : variant === "display"
        ? SIGNED_URL_TTL.display
        : SIGNED_URL_TTL.thumb;

  let rows = data ?? [];
  const contexts = new Map<string, EventContext | null>();
  if (variant === "original" || variant === "share") {
    // Same rule as single downloads: an album with downloads off is only
    // saved by the people who run the event.
    for (const eventId of new Set(rows.map((m) => m.event_id))) {
      contexts.set(eventId, await getEventContextById(eventId));
    }
    rows = rows.filter((m) => m.albums?.allow_download !== false || contexts.get(m.event_id)?.perms.manage_albums);
  }
  const urls = await signPaths(
    supabase,
    mediaClaims(rows.map((m) => ({ ...m, paths: [pathFor(m)] }))),
    ttl,
  );

  const result: Record<string, string> = {};
  for (const m of rows) {
    const path = pathFor(m);
    const url = path ? urls.get(path) : undefined;
    if (url) result[m.id] = url;
  }
  // Save to Photos is a download like any other: it shows under Saved ›
  // Downloaded and in the organiser's activity, as the Download link does.
  for (const [eventId, eventCtx] of contexts) {
    if (eventCtx) await logDownloads(eventCtx, rows.filter((m) => m.event_id === eventId && result[m.id]).map((m) => m.id));
  }
  // Video plays from the R2 copy once it has one: full size files are where
  // the download bill is. RLS above already decided these rows are visible.
  if (variant === "video" || variant === "original") {
    for (const m of rows) {
      if (variant === "video" ? m.kind !== "video" : pathFor(m) !== m.storage_path) continue;
      const fromR2 = await r2Url(m, signedUrlLifetime(ttl));
      if (fromR2) result[m.id] = fromR2;
    }
  }
  // "share" stays on Supabase: the browser downloads it with fetch(), which
  // needs CORS, and Supabase Storage allows it while the R2 bucket may not.
  const kinds: Record<string, string> = {};
  if (variant === "share") for (const m of rows) if (result[m.id]) kinds[m.id] = m.kind;
  return NextResponse.json({ urls: result, kinds, expiresIn: ttl });
}

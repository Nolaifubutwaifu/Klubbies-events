import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById, getSessionUser } from "@/lib/auth/session";
import { r2Url } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, signedUrlLifetime, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  mediaIds: z.array(z.uuid()).min(1).max(200),
  variant: z.enum(["thumb", "display", "video", "original"]).default("thumb"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await getSessionUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const supabase = await createClient();
  // RLS decides which of the requested items this user may see.
  const { data, error } = await supabase
    .from("media")
    .select("id, kind, storage_path, thumb_path, display_path, poster_path, backed_up_at, mime_type, event_id, albums!media_album_id_fkey(allow_download)")
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
    return m.kind === "video" ? m.poster_path : (m.display_path ?? m.storage_path);
  };
  const ttl =
    variant === "video" ? SIGNED_URL_TTL.video : variant === "original" ? SIGNED_URL_TTL.video : variant === "display" ? SIGNED_URL_TTL.display : SIGNED_URL_TTL.thumb;

  let rows = data ?? [];
  if (variant === "original") {
    // Same rule as single downloads: an album with downloads off is only
    // saved by the people who run the event.
    const managed = new Map<string, boolean>();
    for (const eventId of new Set(rows.map((m) => m.event_id))) {
      managed.set(eventId, Boolean((await getEventContextById(eventId))?.perms.manage_albums));
    }
    rows = rows.filter((m) => m.albums?.allow_download !== false || managed.get(m.event_id));
  }
  const urls = await signPaths(
    supabase,
    rows.map(pathFor).filter((p): p is string => Boolean(p)),
    ttl,
  );

  const result: Record<string, string> = {};
  for (const m of rows) {
    const path = pathFor(m);
    const url = path ? urls.get(path) : undefined;
    if (url) result[m.id] = url;
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
  return NextResponse.json({ urls: result, expiresIn: ttl });
}

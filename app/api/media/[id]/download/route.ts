import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { r2Url } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, mediaClaim, signDownload, signedUrlLifetime, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]/download">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media")
    .select("id, event_id, album_id, kind, storage_path, display_path, original_filename, mime_type, byte_size, backed_up_at, albums!media_album_id_fkey(allow_download)")
    .eq("id", id)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const event = await getEventContextById(media.event_id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!event.isAdmin && media.albums?.allow_download === false) {
    return NextResponse.json({ error: "Downloads are turned off for this album" }, { status: 403 });
  }

  const ext = media.storage_path.split(".").pop() ?? "bin";
  const filename = media.original_filename || `klubbies-${media.id}.${ext}`;
  // Full quality comes from the R2 copy, which costs nothing to download;
  // anything not copied yet still comes from Supabase.
  // as=share is iPhone Safari fetching the file itself for the share sheet; the
  // page may only fetch from Supabase storage (lib/security/csp.ts), not R2.
  const as = new URL(request.url).searchParams.get("as");
  const url =
    (as === "share" ? null : await r2Url(media, signedUrlLifetime(SIGNED_URL_TTL.download), filename)) ??
    (media.album_id
      ? await signDownload(supabase, { kind: "media", path: media.storage_path, eventId: media.event_id, albumId: media.album_id, mediaId: media.id }, filename)
      : null);
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAccess(event, media.id, "download");
  // The iPhone app saves into Photos itself, so it asks for the address
  // rather than following a redirect to a storage host it can't download.
  if (as === "share") return NextResponse.json({ url, filename, kind: media.kind, bytes: media.byte_size });
  if (as === "json") {
    // The shipped app names saved photos .jpg or .png, so a HEIC original
    // goes as its full-size display copy, which Photos reads either way.
    const photosReadable = media.kind === "video" || /^image\/(jpeg|png)$/.test(media.mime_type ?? "");
    const saveUrl =
      photosReadable || !media.display_path
        ? url
        : (media.album_id
            ? (await signPaths(supabase, [mediaClaim(media, media.display_path)].filter((c) => c !== null), SIGNED_URL_TTL.display)).get(media.display_path) ?? url
            : url);
    return NextResponse.json({ url: saveUrl, filename, kind: media.kind, bytes: media.byte_size });
  }
  return NextResponse.redirect(url, { status: 303 });
}

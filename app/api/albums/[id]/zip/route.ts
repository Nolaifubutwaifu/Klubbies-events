import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { albumZipItems, zipPartAt, type ZipSource } from "@/lib/media/zip-index";
import { safeFilename, UNAVAILABLE, zipError, zipResponse } from "@/lib/media/zip";
import { createClient } from "@/lib/supabase/server";

// Pro's ceiling. A part of full quality photos and video is slow to stream on
// a weak connection, and a zip cut off at 300s arrives corrupt.
export const maxDuration = 800;

export async function GET(request: Request, ctx: RouteContext<"/api/albums/[id]/zip">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return zipError(request, UNAVAILABLE, 404);
  const params = new URL(request.url).searchParams;
  const part = Math.max(0, Number(params.get("part") ?? 0));
  // "Download these" on the Saved screen asks for a specific handful rather
  // than the whole album, so the zip is just their favourites.
  // "only=" with nothing in it means nothing, not the whole album.
  if (params.has("only") && !params.get("only")) return zipError(request, "Nothing selected", 400);
  const only = (params.get("only") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => z.uuid().safeParse(value).success)
    .slice(0, 1000);

  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, title, allow_download").eq("id", id).maybeSingle();
  if (!album) return zipError(request, UNAVAILABLE, 404);

  const event = await getEventContextById(album.event_id);
  if (!event) return zipError(request, UNAVAILABLE, 404);
  if (!album.allow_download && !event.perms.manage_albums) {
    return zipError(request, "Downloads are turned off for this album", 403);
  }

  let items: (ZipSource & { byteSize: number | null })[];
  if (only.length) {
    const { data, error } = await supabase
      .from("media")
      .select("id, storage_path, original_filename, backed_up_at, byte_size")
      .eq("album_id", album.id)
      .eq("status", "ready")
      .in("id", only);
    if (error) return zipError(request, "Could not load this album", 500);
    const byId = new Map((data ?? []).map((row) => [row.id, { ...row, byteSize: row.byte_size }]));
    items = only.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  } else {
    items = await albumZipItems(supabase, album.id);
  }
  // 150 files or ~500 MB, whichever comes first, so a part finishes inside the function limit.
  const media = zipPartAt(items, part);
  if (!media.length) return zipError(request, "Nothing to download", 404);

  await logAccess(event, null, "zip");

  const title = safeFilename(album.title, "album");
  const filename = only.length ? `${title} (selected).zip` : part > 0 ? `${title} (part ${part + 1}).zip` : `${title}.zip`;
  return zipResponse(supabase, media, filename);
}

import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { PART_SIZE, safeFilename, UNAVAILABLE, zipError, zipResponse } from "@/lib/media/zip";
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
  const only = (params.get("only") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => z.uuid().safeParse(value).success)
    .slice(0, PART_SIZE);

  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, title, allow_download").eq("id", id).maybeSingle();
  if (!album) return zipError(request, UNAVAILABLE, 404);

  const event = await getEventContextById(album.event_id);
  if (!event) return zipError(request, UNAVAILABLE, 404);
  if (!album.allow_download && !event.perms.manage_albums) {
    return zipError(request, "Downloads are turned off for this album", 403);
  }

  let query = supabase
    .from("media")
    .select("id, storage_path, original_filename, sort_at, backed_up_at")
    .eq("album_id", album.id)
    .eq("status", "ready")
    .order("sort_at", { ascending: true })
    .order("id", { ascending: true });
  query = only.length ? query.in("id", only) : query.range(part * PART_SIZE, (part + 1) * PART_SIZE - 1);
  const { data: media } = await query;
  if (!media?.length) return zipError(request, "Nothing to download", 404);

  await logAccess(event, null, "zip");

  const title = safeFilename(album.title, "album");
  const filename = only.length ? `${title} (selected).zip` : part > 0 ? `${title} (part ${part + 1}).zip` : `${title}.zip`;
  return zipResponse(supabase, media, filename);
}

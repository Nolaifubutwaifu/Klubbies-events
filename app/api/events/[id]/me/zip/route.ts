import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { safeFilename, UNAVAILABLE, zipError, zipResponse } from "@/lib/media/zip";
import { yourPhotosZipItems, zipPartAt } from "@/lib/media/zip-index";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 800;

/**
 * Every photo the caller is matched in, across the event's albums, as one zip.
 * Parts close at 150 files or about 500 MB. face_matches RLS already limits
 * the rows to the caller's own profile; albums with downloads switched off
 * are left out.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/events/[id]/me/zip">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return zipError(request, UNAVAILABLE, 404);
  const part = Math.max(0, Number(new URL(request.url).searchParams.get("part") ?? 0));

  const event = await getEventContextById(id);
  if (!event || event.accessClosed) return zipError(request, UNAVAILABLE, 404);

  const supabase = await createClient();
  const items = await yourPhotosZipItems(supabase, id, event.perms.manage_albums).catch((error) => {
    console.error("your photos zip", error);
    return null;
  });
  if (!items) return zipError(request, "Could not load your photos", 500);
  const media = zipPartAt(items, part);
  if (!media.length) return zipError(request, "Nothing to download", 404);

  await logAccess(event, null, "zip");
  const title = safeFilename(event.event.name, "event");
  return zipResponse(supabase, media, part > 0 ? `${title} - your photos (part ${part + 1}).zip` : `${title} - your photos.zip`);
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { PART_SIZE, safeFilename, zipResponse } from "@/lib/media/zip";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 800;

/**
 * Every photo the caller is matched in, across the event's albums, as one zip
 * (in parts of 150). face_matches RLS already limits the rows to the caller's
 * own profile; albums with downloads switched off are left out.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/events/[id]/me/zip">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const part = Math.max(0, Number(new URL(request.url).searchParams.get("part") ?? 0));

  const event = await getEventContextById(id);
  if (!event || event.accessClosed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_matches")
    .select("media_id, media!inner(id, storage_path, original_filename, status, sort_at, content_hash, albums!media_album_id_fkey(allow_download))")
    .eq("event_id", id)
    .eq("state", "confirmed")
    .order("media_id")
    .range(part * PART_SIZE, (part + 1) * PART_SIZE - 1);
  if (error) return NextResponse.json({ error: "Could not load your photos" }, { status: 500 });

  const seen = new Set<string>();
  const media = (data ?? [])
    .map((row) => row.media)
    .filter((m) => m.status === "ready" && (event.perms.manage_albums || m.albums?.allow_download !== false))
    .filter((m) => {
      const key = m.content_hash ?? m.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!media.length) return NextResponse.json({ error: "Nothing to download" }, { status: 404 });

  await logAccess(event, null, "zip");
  const title = safeFilename(event.event.name, "event");
  return zipResponse(supabase, media, part > 0 ? `${title} - your photos (part ${part + 1}).zip` : `${title} - your photos.zip`);
}

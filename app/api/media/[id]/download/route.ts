import { NextResponse } from "next/server";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { signDownload } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]/download">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media")
    .select("id, club_id, storage_path, original_filename, albums(allow_download)")
    .eq("id", id)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const club = await getClubContextById(media.club_id);
  if (!club) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!club.isAdmin && media.albums?.allow_download === false) {
    return NextResponse.json({ error: "Downloads are turned off for this album" }, { status: 403 });
  }

  const ext = media.storage_path.split(".").pop() ?? "bin";
  const filename = media.original_filename || `klubbies-${media.id}.${ext}`;
  const url = await signDownload(supabase, media.storage_path, filename);
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAccess(club, media.id, "download");
  return NextResponse.redirect(url, { status: 303 });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { r2Url } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, signDownload, signedUrlLifetime } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]/download">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media")
    .select("id, event_id, storage_path, original_filename, backed_up_at, albums(allow_download)")
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
  const url =
    (await r2Url(media, signedUrlLifetime(SIGNED_URL_TTL.download), filename)) ??
    (await signDownload(supabase, media.storage_path, filename));
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAccess(event, media.id, "download");
  return NextResponse.redirect(url, { status: 303 });
}

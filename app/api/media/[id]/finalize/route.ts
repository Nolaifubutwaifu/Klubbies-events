import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { FINALIZE_MEDIA_COLUMNS, finalizeSchema, finishUpload } from "@/lib/media/finalize";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, ctx: RouteContext<"/api/media/[id]/finalize">) {
  const { id } = await ctx.params;
  const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media")
    .select(`${FINALIZE_MEDIA_COLUMNS}, uploaded_by` as const)
    .eq("id", id)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The uploader finishes their own file; organisers can finish anyone's.
  const event = await getEventContextById(media.event_id);
  if (!event || (!event.perms.manage_albums && media.uploaded_by !== event.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return finishUpload(supabase, media, parsed.data, { byLink: false });
}

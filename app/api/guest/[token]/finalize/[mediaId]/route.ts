import { NextResponse } from "next/server";
import { z } from "zod";
import { recordGuestUpload, resolveGuestLink } from "@/lib/guest/links";
import { FINALIZE_MEDIA_COLUMNS, finalizeSchema, finishUpload } from "@/lib/media/finalize";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, ctx: RouteContext<"/api/guest/[token]/finalize/[mediaId]">) {
  const { token, mediaId } = await ctx.params;
  const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(mediaId).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { session } = await resolveGuestLink(token);
  if (!session) return NextResponse.json({ error: "This link isn't valid any more." }, { status: 403 });

  const admin = createAdminClient();
  // The link may only finish files it started: the guest_link_id is the check.
  const { data: media } = await admin
    .from("media")
    .select(FINALIZE_MEDIA_COLUMNS)
    .eq("id", mediaId)
    .eq("guest_link_id", session.linkId)
    .maybeSingle();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Counted only by the request that finished the row, so a retry doesn't inflate the tally.
  return finishUpload(admin, media, parsed.data, { byLink: true, onFinished: (bytes) => recordGuestUpload(session.linkId, bytes) });
}

import sharp from "sharp";
import { z } from "zod";
import { faceSquare, uprightDimensions } from "@/lib/faces/crop";
import { cropDecodeOptions, isDecodablePhoto } from "@/lib/media/logo-file";
import { asBox } from "@/lib/faces/queries";
import { BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/** Twice the ~110px tile, so it stays sharp on a retina screen. */
const CROP_SIZE = 240;

/**
 * The face for one "Is this you?" card, cut from the display image on the
 * fly. The card used to download the whole 2000px display copy and crop it in
 * CSS, which cost about a megabyte per ~105px tile.
 *
 * Nothing is stored: the crop is made per request and cached only by the
 * member's own browser. Stored face crops would be a second pile of
 * biometric-adjacent files to secure and delete, which is why the design
 * never had them (DECISIONS 84).
 *
 * Authorisation is the user's own client throughout. RLS limits face_matches
 * to the caller's own profile and storage reads to media they may see, so a
 * match id that isn't yours finds no row and no bytes.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/faces/[matchId]/crop">) {
  const { matchId } = await ctx.params;
  if (!z.uuid().safeParse(matchId).success) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("face_matches")
    .select("bounding_box, media!inner(display_path, storage_path)")
    .eq("id", matchId)
    .maybeSingle();
  const box = asBox(match?.bounding_box ?? null);
  const path = match?.media.display_path ?? match?.media.storage_path;
  if (!match || !box || !path) return new Response(null, { status: 404 });

  const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !file) return new Response(null, { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isDecodablePhoto(bytes)) return new Response(null, { status: 422 });

  try {
    // Header only, then one decode. Rotating into a buffer and decoding it
    // again held two copies of the frame. Four of those at the gallery cap
    // sit over 2 GB. The box is in upright pixels, so a sideways EXIF
    // orientation swaps the axes before rotate+extract run in one pipeline.
    // 40 million pixels keeps four parallel crops well under 2 GB.
    const header = await sharp(bytes, cropDecodeOptions).metadata();
    if (!header.width || !header.height) return new Response(null, { status: 422 });
    const upright = uprightDimensions(header.width, header.height, header.orientation);
    const { left, top, size } = faceSquare(box, upright.width, upright.height);
    const crop = await sharp(bytes, cropDecodeOptions)
      .rotate()
      .extract({ left, top, width: size, height: size })
      .resize(CROP_SIZE, CROP_SIZE)
      .webp({ quality: 80 })
      .toBuffer();
    return new Response(new Uint8Array(crop), {
      headers: {
        "content-type": "image/webp",
        // Private: it is one member's face match, never for a shared cache.
        "cache-control": "private, max-age=86400",
      },
    });
  } catch (cropError) {
    console.error("face crop failed", matchId, cropError);
    return new Response(null, { status: 422 });
  }
}

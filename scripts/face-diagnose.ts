/**
 * Why did a club's photos keep no faces? Indexes a sample into a throwaway
 * collection with Rekognition's HIGH filter, prints every face it kept and
 * every face it refused (with AWS's reason), at two resolutions, then deletes
 * the collection. Costs about US$0.002 per photo.
 *
 *   pnpm tsx --env-file=.env.local scripts/face-diagnose.ts --club uqbvc --limit 12
 */
import {
  CreateCollectionCommand,
  DeleteCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const handle = arg("club");
const limit = Number(arg("limit") ?? 10);
if (!handle) throw new Error("--club <handle> is required");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const aws = new RekognitionClient({ region: process.env.AWS_REGION ?? "ap-southeast-2" });
const collection = `${process.env.REKOGNITION_COLLECTION_PREFIX ?? "klubbies-dev"}-diagnose-${Date.now()}`;

async function jpeg(bytes: ArrayBuffer, edge: number): Promise<{ buf: Buffer; w: number }> {
  let quality = 88;
  for (;;) {
    const { data, info } = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer({ resolveWithObject: true });
    if (data.length < 4.9 * 1024 * 1024 || quality < 50) return { buf: data, w: info.width };
    quality -= 10;
  }
}

async function main() {
  const { data: club } = await supabase.from("clubs").select("id").eq("handle", handle!).single();
  const { data: media } = await supabase
    .from("media")
    .select("id, storage_path, display_path, width, height")
    .eq("club_id", club!.id)
    .eq("kind", "photo")
    .eq("status", "ready")
    .limit(limit);
  await aws.send(new CreateCollectionCommand({ CollectionId: collection }));
  const totals: Record<string, { kept: number; px: number[]; reasons: Record<string, number> }> = {};
  try {
    for (const m of media ?? []) {
      for (const [label, path, edge] of [
        ["display@2000", m.display_path ?? m.storage_path, 2000],
        ["original@4096", m.storage_path, 4096],
      ] as const) {
        const { data: blob, error } = await supabase.storage.from("club_media").download(path);
        if (error || !blob) {
          console.log(m.id, label, "download failed", error?.message);
          continue;
        }
        const { buf, w } = await jpeg(await blob.arrayBuffer(), edge).catch(() => ({ buf: Buffer.alloc(0), w: 0 }));
        if (!w) {
          console.log(m.id, label, "could not decode");
          continue;
        }
        const res = await aws.send(
          new IndexFacesCommand({
            CollectionId: collection,
            Image: { Bytes: buf },
            QualityFilter: "HIGH",
            MaxFaces: 25,
            DetectionAttributes: ["DEFAULT"],
          }),
        );
        const t = (totals[label] ??= { kept: 0, px: [], reasons: {} });
        const kept = (res.FaceRecords ?? []).map((r) => ({
          widthPct: +((r.Face?.BoundingBox?.Width ?? 0) * 100).toFixed(1),
          px: Math.round((r.Face?.BoundingBox?.Width ?? 0) * w),
          sharp: Math.round(r.FaceDetail?.Quality?.Sharpness ?? 0),
          bright: Math.round(r.FaceDetail?.Quality?.Brightness ?? 0),
        }));
        t.kept += kept.length;
        t.px.push(...kept.map((k) => k.px));
        for (const u of res.UnindexedFaces ?? []) for (const reason of u.Reasons ?? []) t.reasons[reason] = (t.reasons[reason] ?? 0) + 1;
        const refused = (res.UnindexedFaces ?? []).map(
          (u) => `${((u.FaceDetail?.BoundingBox?.Width ?? 0) * 100).toFixed(1)}%:${(u.Reasons ?? []).join("+")}`,
        );
        console.log(`${m.id.slice(0, 8)} ${label} img=${w}px kept=${JSON.stringify(kept)} refused=[${refused.join(", ")}]`);
      }
    }
  } finally {
    await aws.send(new DeleteCollectionCommand({ CollectionId: collection }));
  }
  for (const [label, t] of Object.entries(totals)) {
    const px = t.px.sort((a, b) => a - b);
    console.log(`\n${label}: kept ${t.kept} faces; face px min/median/max ${px[0]}/${px[Math.floor(px.length / 2)]}/${px.at(-1)}; refused ${JSON.stringify(t.reasons)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

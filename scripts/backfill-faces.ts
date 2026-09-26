/**
 * First face-recognition pass over a club's back catalogue.
 *
 *   pnpm tsx --env-file=.env.local scripts/backfill-faces.ts --club demo_umfc --concurrency 8
 *
 * Do the arithmetic before trusting the cron with this. One photo costs a
 * download, a sharp transcode, an IndexFaces and a couple of SearchFaces —
 * roughly 1.5 to 3 seconds serially. A 300-second Vercel function at a
 * concurrency of 8 clears somewhere around 800 to 1,500 photos, which is fine
 * for a club with 2,000 and hopeless for one with 50,000 on a once-daily
 * Hobby cron. A local script has no timeout, and the jobs table makes it
 * resumable if it dies halfway.
 *
 * Nothing is spent without --confirm.
 */
import {
  DeleteFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesCommand,
  CreateCollectionCommand,
  type FaceRecord,
} from "@aws-sdk/client-rekognition";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../lib/db/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION ?? "ap-southeast-2";
const prefix = process.env.REKOGNITION_COLLECTION_PREFIX ?? "klubbies-dev";

if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
if (!accessKeyId || !secretAccessKey) throw new Error("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local");

const BUCKET = "club_media";

// Mirrors lib/faces/constants.ts. Kept as literals rather than imported so
// this script never pulls "server-only" modules into a plain tsx process.
const QUALITY_FILTER = "HIGH" as const;
const MAX_FACES_PER_PHOTO = 25;
const MIN_BOX_WIDTH = 0.04;
const MIN_SHARPNESS = 20;
const MIN_BRIGHTNESS = 25;
const SEARCH_THRESHOLD = 85;
const CONFIRMED_AT = 92;
const SEARCH_MAX_FACES = 10;
const TRANSCODE_MAX_EDGE = 2000;
const TRANSCODE_QUALITY = 85;

/** Rekognition Group 1 pricing, first tier, from memory. Verify before trusting. */
const USD_PER_IMAGE = 0.001;

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const db: SupabaseClient<Database> = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rekognition = new RekognitionClient({ region, credentials: { accessKeyId, secretAccessKey } });

function clearsFloors(record: FaceRecord): boolean {
  if ((record.Face?.BoundingBox?.Width ?? 0) < MIN_BOX_WIDTH) return false;
  if ((record.FaceDetail?.Quality?.Sharpness ?? 0) < MIN_SHARPNESS) return false;
  if ((record.FaceDetail?.Quality?.Brightness ?? 0) < MIN_BRIGHTNESS) return false;
  return true;
}

let indexedFaces = 0;
let createdMatches = 0;
let throttled = false;

async function processOne(clubId: string, collectionId: string, mediaId: string): Promise<void> {
  const { data: media } = await db
    .from("media")
    .select("id, storage_path, display_path, kind, status")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media || media.kind !== "photo" || media.status !== "ready") return;

  const path = media.display_path ?? media.storage_path;
  const { data: blob, error } = await db.storage.from(BUCKET).download(path);
  if (error || !blob) throw new Error(`download failed for ${path}`);

  // Rekognition takes JPEG and PNG only; our display copies are WebP.
  const jpeg = await sharp(new Uint8Array(await blob.arrayBuffer()))
    .rotate()
    .resize(TRANSCODE_MAX_EDGE, TRANSCODE_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: TRANSCODE_QUALITY })
    .toBuffer();

  await db.from("media_faces").delete().eq("media_id", mediaId);

  const indexed = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: new Uint8Array(jpeg) },
      ExternalImageId: `media:${mediaId}`,
      QualityFilter: QUALITY_FILTER,
      MaxFaces: MAX_FACES_PER_PHOTO,
      DetectionAttributes: [],
    }),
  );

  const records = indexed.FaceRecords ?? [];
  const kept = records.filter(clearsFloors);
  const droppedIds = records
    .filter((r) => !clearsFloors(r))
    .map((r) => r.Face?.FaceId)
    .filter((id): id is string => Boolean(id));
  if (droppedIds.length) {
    await rekognition.send(new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: droppedIds }));
  }
  if (kept.length === 0) return;

  const { data: inserted } = await db
    .from("media_faces")
    .insert(
      kept.map((record) => ({
        club_id: clubId,
        media_id: mediaId,
        collection_id: collectionId,
        rekognition_face_id: record.Face!.FaceId!,
        bounding_box: record.Face!.BoundingBox as unknown as Record<string, number>,
        confidence: record.Face?.Confidence ?? null,
        sharpness: record.FaceDetail?.Quality?.Sharpness ?? null,
        brightness: record.FaceDetail?.Quality?.Brightness ?? null,
      })),
    )
    .select("id, rekognition_face_id, bounding_box");
  indexedFaces += kept.length;

  const { data: profiles } = await db
    .from("member_face_profiles")
    .select("id, membership_id")
    .eq("club_id", clubId)
    .eq("status", "ready")
    .is("revoked_at", null);
  if (!profiles?.length) return;
  const profileByMembership = new Map(profiles.map((p) => [p.membership_id, p.id]));

  const { data: rejections } = await db.from("face_rejections").select("profile_id").eq("media_id", mediaId);
  const rejected = new Set((rejections ?? []).map((r) => r.profile_id));

  const best = new Map<string, { mediaFaceId: string; similarity: number; box: unknown }>();
  for (const face of inserted ?? []) {
    const found = await rekognition.send(
      new SearchFacesCommand({
        CollectionId: collectionId,
        FaceId: face.rekognition_face_id,
        FaceMatchThreshold: SEARCH_THRESHOLD,
        MaxFaces: SEARCH_MAX_FACES,
      }),
    );
    for (const match of found.FaceMatches ?? []) {
      const external = match.Face?.ExternalImageId ?? "";
      if (!external.startsWith("ref:")) continue;
      const profileId = profileByMembership.get(external.slice(4));
      if (!profileId || rejected.has(profileId)) continue;
      const similarity = match.Similarity ?? 0;
      const current = best.get(profileId);
      if (!current || similarity > current.similarity) {
        best.set(profileId, { mediaFaceId: face.id, similarity, box: face.bounding_box });
      }
    }
  }

  const rows = [...best.entries()].map(([profileId, value]) => ({
    club_id: clubId,
    media_id: mediaId,
    media_face_id: value.mediaFaceId,
    profile_id: profileId,
    similarity: value.similarity,
    bounding_box: value.box as never,
    state: value.similarity >= CONFIRMED_AT ? ("confirmed" as const) : ("suggested" as const),
  }));
  if (rows.length) {
    await db.from("face_matches").upsert(rows, { onConflict: "profile_id,media_id", ignoreDuplicates: true });
    createdMatches += rows.length;
  }
}

async function main() {
  const handle = arg("club");
  const concurrency = Number(arg("concurrency") ?? 8);
  if (!handle) throw new Error("Pass --club <handle>");

  const { data: club } = await db.from("clubs").select("id, name, handle").eq("handle", handle).maybeSingle();
  if (!club) throw new Error(`No club with handle ${handle}`);

  const collectionId = `${prefix}-club-${club.id}`;
  const { count: photoCount } = await db
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("club_id", club.id)
    .eq("status", "ready")
    .eq("kind", "photo");

  const total = photoCount ?? 0;
  const estimate = (total * USD_PER_IMAGE).toFixed(2);
  console.log(`${club.name} (@${club.handle})`);
  console.log(`  collection   ${collectionId}`);
  console.log(`  photos       ${total.toLocaleString("en-AU")}`);
  console.log(`  est. cost    about US$${estimate} to index once, plus a few cents a month to store`);
  console.log(`               (Rekognition pricing from memory — check it before you trust this)`);

  if (!flag("confirm")) {
    console.log("\nDry run. Re-run with --confirm to spend money.");
    return;
  }

  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
    console.log(`\nCreated collection ${collectionId}`);
  } catch (error) {
    if ((error as { name?: string }).name !== "ResourceAlreadyExistsException") throw error;
  }

  await db
    .from("club_face_settings")
    .upsert({ club_id: club.id, collection_id: collectionId, backfill_status: "running" }, { onConflict: "club_id" });

  // Queue the library before draining it. Turning the feature on in the admin
  // panel does this too, but running the script first has to work on its own —
  // otherwise it claims an empty queue and cheerfully reports zero photos.
  // The partial unique index makes this a no-op for anything already queued,
  // so the two paths cannot double up.
  const { data: photos } = await db
    .from("media")
    .select("id")
    .eq("club_id", club.id)
    .eq("status", "ready")
    .eq("kind", "photo")
    .order("created_at", { ascending: false });
  // No upsert here: face_jobs_media_live_idx is a PARTIAL unique index and
  // Postgres will not infer ON CONFLICT from one, so an upsert fails with
  // 42P10. Skip what is already live, insert the rest, and let the index
  // catch a race by falling back to row-by-row. (lib/faces/backfill.ts holds
  // the same logic; this file cannot import it because it is server-only.)
  const { data: liveJobs } = await db
    .from("face_jobs")
    .select("media_id")
    .eq("club_id", club.id)
    .eq("kind", "index_media")
    .in("status", ["pending", "running"]);
  const alreadyQueued = new Set((liveJobs ?? []).map((row) => row.media_id));
  const todo = (photos ?? []).map((photo) => photo.id).filter((id) => !alreadyQueued.has(id));

  let newlyQueued = 0;
  for (let i = 0; i < todo.length; i += 500) {
    const chunk = todo.slice(i, i + 500).map((id) => ({
      club_id: club.id,
      media_id: id,
      kind: "index_media" as const,
    }));
    const { error } = await db.from("face_jobs").insert(chunk);
    if (!error) {
      newlyQueued += chunk.length;
      continue;
    }
    if (error.code !== "23505") throw error;
    for (const row of chunk) {
      const { error: rowError } = await db.from("face_jobs").insert(row);
      if (!rowError) newlyQueued += 1;
      else if (rowError.code !== "23505") throw rowError;
    }
  }
  console.log(`Queued ${newlyQueued.toLocaleString("en-AU")} photo(s); draining at a concurrency of ${concurrency}.\n`);

  // Claims through the same function the cron uses, so a drain running on
  // Vercel at the same time takes different rows rather than the same ones.
  let processed = 0;
  let failures = 0;
  for (;;) {
    const { data: jobs, error } = await db.rpc("claim_face_jobs", { batch_size: concurrency * 4 });
    if (error) throw error;
    if (!jobs?.length) break;

    const queue = [...jobs];
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          if (job.kind !== "index_media" || !job.media_id) {
            await db.from("face_jobs").update({ status: "done" }).eq("id", job.id);
            continue;
          }
          try {
            await processOne(club.id, collectionId, job.media_id);
            await db.from("face_jobs").update({ status: "done", last_error: null }).eq("id", job.id);
          } catch (jobError) {
            const name = (jobError as { name?: string }).name ?? "";
            // Throttling means stop, not retry: burning attempts against a
            // rate limit only makes the limit last longer.
            if (name === "ThrottlingException" || name === "ProvisionedThroughputExceededException") {
              throttled = true;
            }
            failures += 1;
            await db
              .from("face_jobs")
              .update({
                status: "pending",
                run_after: new Date(Date.now() + 60_000).toISOString(),
                last_error: String(jobError).slice(0, 500),
              })
              .eq("id", job.id);
          }
          processed += 1;
          if (processed % 100 === 0) {
            console.log(`  ${processed.toLocaleString("en-AU")} photos · ${indexedFaces} faces · ${createdMatches} matches`);
          }
        }
      }),
    );

    if (throttled) {
      console.error("\nAWS is throttling. Stopping cleanly — the jobs table keeps your place, so re-run later.");
      break;
    }
  }

  await db
    .from("club_face_settings")
    .update({
      backfill_status: throttled ? "running" : "done",
      backfill_completed_at: throttled ? null : new Date().toISOString(),
    })
    .eq("club_id", club.id);

  console.log(`\nDone. ${processed.toLocaleString("en-AU")} photos, ${indexedFaces} faces indexed, ${createdMatches} matches created, ${failures} failures.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import "server-only";
import { after } from "next/server";
import type { FaceJob, FaceJobKind } from "@/lib/db/types";
import { removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { facesConfigured, isThrottling } from "./client";
import { ensureClubCollection } from "./collections";
import { DRAIN_BUDGET_MS, JOB_BATCH_SIZE, JOB_CONCURRENCY, MAX_JOB_ATTEMPTS, UPLOAD_KICK_BUDGET_MS } from "./constants";
import { enrolProfile } from "./enrol";
import { indexMedia, rematchMedia } from "./index-media";
import { matchClubMedia } from "./match";
import { drainFacePurgeQueue } from "./purge";

export type DrainResult = { claimed: number; done: number; failed: number; purged: number; searches: number };

/**
 * The cron runs hourly, which is too slow for a member waiting to see their
 * own photos. So the drain has to be callable from three places and safe from
 * all of them:
 *
 *   1. the hourly cron,
 *   2. after the response of an upload, so a new photo matches within
 *      seconds rather than at the next cron pass,
 *   3. an admin "Run now" button, for backfill and for when something sticks.
 *
 * claim_face_jobs uses `for update skip locked`, so two of these running at
 * once take different work rather than the same work twice.
 */
export async function runFaceJobs(options: { budgetMs?: number; batchSize?: number } = {}): Promise<DrainResult> {
  if (!facesConfigured()) return { claimed: 0, done: 0, failed: 0, purged: 0, searches: 0 };
  const budgetMs = options.budgetMs ?? DRAIN_BUDGET_MS;
  const batchSize = options.batchSize ?? JOB_BATCH_SIZE;
  const deadline = Date.now() + budgetMs;

  const admin = createAdminClient();
  let claimedTotal = 0;
  let done = 0;
  let failed = 0;
  let searches = 0;
  const ensured = new Set<string>();

  // Keep claiming until the queue is empty or the clock runs out. A single
  // batch used to be the whole pass, which meant a 110 photo library needed
  // five separate triggers and, back when the cron ran once a day on Hobby,
  // five days. Nothing ever asked for the next batch.
  while (Date.now() < deadline) {
    const { data: claimed, error } = await admin.rpc("claim_face_jobs", { batch_size: batchSize });
    if (error) throw error;
    const jobs = (claimed ?? []) as FaceJob[];
    if (jobs.length === 0) break;
    claimedTotal += jobs.length;

    // A club switched on by the rollout migration has no collection yet: the
    // database can't create one. Make sure each club in the batch has one
    // before any of its photos is indexed. CreateCollection is idempotent, so
    // this is one cheap call per club per pass.
    for (const clubId of new Set(jobs.map((job) => job.club_id))) {
      if (ensured.has(clubId)) continue;
      try {
        await ensureCollectionRecorded(admin, clubId);
        ensured.add(clubId);
      } catch (error) {
        console.error("could not ensure face collection", clubId, error);
      }
    }

    // Photos this batch touched, per club, so matching runs once over the
    // batch rather than once per face.
    const touched = new Map<string, Set<string>>();

    // A fixed pool rather than Promise.all: eight concurrent AWS calls is the
    // shape that fits a 300-second function without tripping throttling.
    const queue = [...jobs];
    const workers = Array.from({ length: Math.min(JOB_CONCURRENCY, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const ok = await runOne(job);
        if (ok) {
          done += 1;
          if (job.media_id) {
            const set = touched.get(job.club_id) ?? new Set<string>();
            set.add(job.media_id);
            touched.set(job.club_id, set);
          }
        } else failed += 1;
      }
    });
    await Promise.all(workers);

    for (const [clubId, mediaIds] of touched) {
      try {
        const result = await matchClubMedia(clubId, [...mediaIds]);
        searches += result.searches;
        if (result.searches) {
          console.log(`face: matched ${mediaIds.size} photo(s) ${result.direction}, ${result.searches} search(es), ${result.written} match(es)`);
        }
      } catch (error) {
        // A failed match leaves the faces indexed, so the next pass retries it
        // without paying to index them again.
        console.error("face matching failed", clubId, error);
      }
    }
  }

  await revokeOrphanedProfiles();
  const purge = await drainFacePurgeQueue();
  await settleBackfills();

  return { claimed: claimedTotal, done, failed, purged: purge.deleted, searches };
}

/** Creates the club's collection if it is missing and records its id. */
async function ensureCollectionRecorded(admin: ReturnType<typeof createAdminClient>, clubId: string): Promise<void> {
  const collectionId = await ensureClubCollection(clubId);
  if (!collectionId) return;
  await admin
    .from("club_face_settings")
    .update({ collection_id: collectionId })
    .eq("club_id", clubId)
    .is("collection_id", null);
}

async function runOne(job: FaceJob): Promise<boolean> {
  const admin = createAdminClient();
  try {
    if (job.kind === "index_media" && job.media_id) await indexMedia(job.club_id, job.media_id);
    else if (job.kind === "rematch_media" && job.media_id) await rematchMedia(job.club_id, job.media_id);
    else if (job.kind === "enrol_profile" && job.profile_id) await enrolProfile(job.profile_id);
    await admin.from("face_jobs").update({ status: "done", last_error: null }).eq("id", job.id);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Throttling is the queue telling us to slow down, not a bad job: it goes
    // back with a short delay and does not spend one of its five attempts.
    const throttled = isThrottling(error);
    const attempts = throttled ? Math.max(0, job.attempts - 1) : job.attempts;
    const giveUp = !throttled && attempts >= MAX_JOB_ATTEMPTS;
    await admin
      .from("face_jobs")
      .update({
        status: giveUp ? "failed" : "pending",
        attempts,
        // Linear backoff. Five attempts spans about 75 minutes, which is long
        // enough for a transient AWS problem and short enough to notice.
        run_after: new Date(Date.now() + (throttled ? 60_000 : 5 * 60_000 * Math.max(1, attempts))).toISOString(),
        last_error: message.slice(0, 500),
      })
      .eq("id", job.id);
    if (giveUp) console.error("face job failed for good", job.id, job.kind, message);
    return false;
  }
}

/**
 * A membership that ends takes its faceprint with it.
 *
 * Deleting a membership row cascades, so that path needs nothing. The one
 * that does not is a membership that merely *changes* — grace expiring into
 * 'revoked', or an admin taking someone off the list — because the row stays
 * and the profile would quietly outlive the access it was granted under.
 *
 * Doing it here rather than in each of those call sites means one rule
 * covering every way a membership can end, including ways added later.
 */
async function revokeOrphanedProfiles(): Promise<void> {
  const admin = createAdminClient();
  const { data: stale } = await admin
    .from("member_face_profiles")
    .select("id, selfie_path, memberships!inner(status)")
    .eq("memberships.status", "revoked")
    .limit(500);
  if (!stale?.length) return;

  const selfies = stale.map((row) => row.selfie_path).filter((path): path is string => Boolean(path));
  await admin
    .from("member_face_profiles")
    .delete()
    .in(
      "id",
      stale.map((row) => row.id),
    );
  if (selfies.length) {
    await removeObjects(selfies).catch((error) => console.error("could not remove revoked selfies", error));
  }
  console.log(`face: removed ${stale.length} profile(s) for revoked memberships`);
}

/**
 * A club's backfill is done when it has no live jobs left — and stops being
 * done the moment it has some again.
 *
 * This used to look only at clubs already marked queued or running, so a club
 * marked done could never be re-opened: a job reclaimed after a timeout, or a
 * rematch queued later, left the panel claiming the library was finished while
 * photos sat unprocessed. Every enabled club is checked now, in both
 * directions.
 */
async function settleBackfills(): Promise<void> {
  const admin = createAdminClient();
  const { data: running } = await admin.from("club_face_settings").select("club_id").eq("enabled", true);
  for (const row of running ?? []) {
    const { count } = await admin
      .from("face_jobs")
      .select("id", { count: "exact", head: true })
      .eq("club_id", row.club_id)
      .in("status", ["pending", "running"]);
    await admin
      .from("club_face_settings")
      .update(
        count && count > 0
          ? { backfill_status: "running" }
          : { backfill_status: "done", backfill_completed_at: new Date().toISOString() },
      )
      .eq("club_id", row.club_id);
  }
}

/**
 * Queues one photo. Called from the upload finalize routes, where a failure
 * to enqueue must never fail the upload: a missing face job is a nuisance, a
 * failed upload is not.
 */
export async function enqueueMediaJob(clubId: string, mediaId: string, kind: FaceJobKind = "index_media"): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("face_jobs").insert({ club_id: clubId, media_id: mediaId, kind });
  // 23505 is the partial unique index: already queued, which is the outcome
  // we wanted anyway.
  if (error && error.code !== "23505") throw error;
}

export async function enqueueEnrolJob(clubId: string, profileId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("face_jobs")
    .insert({ club_id: clubId, profile_id: profileId, kind: "enrol_profile" });
  if (error && error.code !== "23505") throw error;
}

/**
 * Fire-and-forget drain for the upload path. Never throws, never blocks the
 * response: the cron and the admin button are the safety net.
 */
export function kickFaceJobs(): void {
  if (!facesConfigured()) return;
  // Short budget: this rides on an upload request, and its job is to get the
  // photo just uploaded matched within seconds. Clearing a backfill is the
  // cron's work, or the admin's "Run now".
  //
  // `after`, not a bare promise: on Vercel a function can be frozen the moment
  // its response is sent, so an unawaited drain was never guaranteed to run.
  // `after` holds the invocation open until the work settles. Outside a
  // request (a script, a test) it throws, and the drain just runs inline.
  const drain = () =>
    runFaceJobs({ budgetMs: UPLOAD_KICK_BUDGET_MS, batchSize: JOB_CONCURRENCY })
      .then(() => undefined)
      .catch((error) => console.error("face drain failed", error));
  try {
    after(drain);
  } catch {
    void drain();
  }
}

export type FaceQueueStats = { pending: number; running: number; failed: number };

export async function faceQueueStats(clubId: string): Promise<FaceQueueStats> {
  const admin = createAdminClient();
  const counts = await Promise.all(
    (["pending", "running", "failed"] as const).map((status) =>
      admin
        .from("face_jobs")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("status", status),
    ),
  );
  return { pending: counts[0].count ?? 0, running: counts[1].count ?? 0, failed: counts[2].count ?? 0 };
}

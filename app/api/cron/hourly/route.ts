import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pruneRateEvents } from "@/lib/auth/rate-limit";
import { isMonthlyCheckHour, runBackupDrain, runBackupPurge, runMonthlyBackupCheck } from "@/lib/backup/r2";
import { runPlanNotices } from "@/lib/billing/notices";
import { closeOverflowWindows } from "@/lib/billing/usage";
import { serverEnv } from "@/lib/env";
import { runFaceJobs } from "@/lib/faces/jobs";
import { runBinPurge } from "@/lib/media/bin";
import { runRemovalSweep } from "@/lib/media/removals";
import { runScheduledPublishJob } from "@/lib/media/schedule";
import { runUnfinishedSweep } from "@/lib/media/unfinished";
import { prunePendingSignIns, runAccessEndingJob } from "@/lib/notify";

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Via Vercel Cron (vercel.json), hourly on the Pro plan: publishes albums whose scheduled time has
// passed, deletes photos whose removal request nobody answered, emails
// attendees a week before a gallery closes, clears uploads that never
// finished within 14 days, empties anything in Recently deleted for more
// than 30 days, and closes guest overflow windows that have run 48 hours
// (pausing the guests who joined last). It copies new uploads to R2 that the
// upload request didn't, deletes R2 copies whose 30 days are up, and on the
// 1st of each month checks R2 for events that no longer exist. Closing itself needs no job: RLS compares
// events.access_ends_at with now() on every read.
// Publishing runs first so a scheduled album is live as early in the pass as
// possible.
//
// Face jobs run last. This pass is also the backstop that deletes revoked
// faceprints from AWS, so hourly keeps it well inside the consent copy's 24
// hours. Uploads kick their own drain, so in practice this catches backfill
// and anything that errored or was throttled.
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  // The run shares one 300 second limit, so each long job gets what is left
  // rather than a fixed slice: face search used to assume it had 240 of it.
  const deadline = Date.now() + 280_000;
  const left = (cap: number) => Math.max(0, Math.min(cap, deadline - Date.now()));

  const scheduled = await runScheduledPublishJob();
  const removals = await runRemovalSweep();
  const accessEnding = await runAccessEndingJob();
  await prunePendingSignIns();
  const unfinished = await runUnfinishedSweep();
  const bin = await runBinPurge(new Date(), left(45_000));
  const overflowClosed = (await closeOverflowWindows().catch((error) => (console.error("overflow windows", error), []))).length;
  const planNotices = await runPlanNotices().catch((error) => (console.error("plan notices", error), 0));
  const backup = await runBackupDrain(left(70_000)).catch((error) => (console.error("backup drain", error), null));
  const backupPurged = await runBackupPurge().catch((error) => (console.error("backup purge", error), 0));
  const backupCheck = isMonthlyCheckHour()
    ? await runMonthlyBackupCheck().catch((error) => (console.error("monthly backup check", error), null))
    : null;
  const faces = await runFaceJobs({ budgetMs: left(240_000) });
  await pruneRateEvents();
  return NextResponse.json({ scheduled, removals, accessEnding, unfinished, bin, overflowClosed, planNotices, backup, backupPurged, backupCheck, faces });
}

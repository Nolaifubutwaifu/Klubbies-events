import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pruneRateEvents } from "@/lib/auth/rate-limit";
import { serverEnv } from "@/lib/env";
import { runFaceJobs } from "@/lib/faces/jobs";
import { runRemovalSweep } from "@/lib/media/removals";
import { runScheduledPublishJob } from "@/lib/media/schedule";
import { runUnfinishedSweep } from "@/lib/media/unfinished";
import { runGraceJob } from "@/lib/membership/grace";

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Via Vercel Cron (vercel.json), hourly on the Pro plan: publishes albums whose scheduled time has
// passed, deletes photos whose removal request nobody answered, revokes
// expired grace memberships, sends the day 7 and day 29 reminders, and clears
// uploads that never finished within 14 days.
// Publishing runs first so a scheduled album is live as early in the pass as
// possible.
//
// Face jobs run last. This pass is also the backstop that deletes revoked
// faceprints from AWS, so hourly keeps it well inside the consent copy's 24
// hours. Uploads kick their own drain, so in practice this catches backfill
// and anything that errored or was throttled.
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const scheduled = await runScheduledPublishJob();
  const removals = await runRemovalSweep();
  const grace = await runGraceJob();
  const unfinished = await runUnfinishedSweep();
  const faces = await runFaceJobs();
  await pruneRateEvents();
  return NextResponse.json({ scheduled, removals, grace, unfinished, faces });
}

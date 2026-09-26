"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { backfillProgress, queueClubBackfill } from "@/lib/faces/backfill";
import { ensureClubCollection } from "@/lib/faces/collections";
import { CLUB_NOTICE_VERSION, CONSENT_VERSION, MEMBER_NOTICE_VERSION } from "@/lib/faces/constants";
import { facesConfigured } from "@/lib/faces/client";
import { promoteMatchToReference, revokeProfile, selfiePath } from "@/lib/faces/enrol";
import { enqueueEnrolJob, kickFaceJobs, runFaceJobs } from "@/lib/faces/jobs";
import { deleteClubCollection, drainFacePurgeQueue } from "@/lib/faces/purge";
import { BUCKET, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./admin/actions";

// Two gates, in order: the club has the feature on, then each member decides
// for themselves. Clubs are on by default since the 2026-09-25 rollout
// (supabase/migrations/20260925000021) and an admin can still switch theirs
// off; enrolment is never automatic, and writes a versioned consent record.

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function managerContext(clubId: string) {
  const ctx = await getClubContextById(clubId);
  if (!ctx?.perms.manage_albums) return null;
  return ctx;
}

/**
 * Accepting the notice, creating the collection and queueing the backfill are
 * one action because they are one decision. Accepting without the backfill
 * would leave a club that has said yes and sees nothing.
 */
export async function enableClubFacesAction(clubId: string, accepted: boolean): Promise<ActionState> {
  if (!z.uuid().safeParse(clubId).success) return { error: "Not found" };
  const ctx = await managerContext(clubId);
  if (!ctx) return { error: "Not authorised" };
  if (!accepted) return { error: "Tick the box to confirm you have read the notice." };
  if (!facesConfigured()) {
    return { error: "Face recognition is not configured on this deployment yet." };
  }

  let collectionId: string | null;
  try {
    collectionId = await ensureClubCollection(clubId);
  } catch (error) {
    console.error("could not create face collection", clubId, error);
    return { error: "We could not set this up with AWS. Try again in a minute." };
  }
  if (!collectionId) return { error: "Face recognition is not configured on this deployment yet." };

  const admin = createAdminClient();
  const { error } = await admin.from("club_face_settings").upsert(
    {
      club_id: clubId,
      enabled: true,
      collection_id: collectionId,
      notice_accepted_at: new Date().toISOString(),
      notice_accepted_by: ctx.userId,
      notice_version: CLUB_NOTICE_VERSION,
    },
    { onConflict: "club_id" },
  );
  if (error) return { error: "Could not save that. Try again." };

  const { queued } = await queueClubBackfill(clubId);
  kickFaceJobs();

  revalidatePath(`/admin/${ctx.club.handle}/settings`);
  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return {
    ok: true,
    message: queued
      ? `On. ${queued.toLocaleString("en-AU")} photos queued — members can enrol now.`
      : "On. Members can enrol now.",
  };
}

/**
 * Turning it off is the destructive path, and it has to be complete: one
 * DeleteCollection removes every faceprint the club ever had, the rows go,
 * and every enrolment selfie is removed. Nothing is left to a sweep.
 */
export async function disableClubFacesAction(clubId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(clubId).success) return { error: "Not found" };
  const ctx = await managerContext(clubId);
  if (!ctx) return { error: "Not authorised" };

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("club_face_settings")
    .select("collection_id")
    .eq("club_id", clubId)
    .maybeSingle();

  const { data: profiles } = await admin
    .from("member_face_profiles")
    .select("id, selfie_path")
    .eq("club_id", clubId);
  const selfies = (profiles ?? []).map((p) => p.selfie_path).filter((p): p is string => Boolean(p));

  // Rows first. The purge triggers will queue every face id, which is belt
  // and braces: DeleteCollection below takes them all in one call anyway.
  await admin.from("face_jobs").delete().eq("club_id", clubId);
  await admin.from("member_face_profiles").delete().eq("club_id", clubId);
  await admin.from("media_faces").delete().eq("club_id", clubId);

  if (settings?.collection_id) {
    try {
      await deleteClubCollection(settings.collection_id);
      // The collection is gone, so its queued ids are already dead.
      await admin.from("face_purge_queue").delete().eq("collection_id", settings.collection_id);
    } catch (error) {
      console.error("could not delete face collection", clubId, error);
      return { error: "We removed the records but AWS did not confirm. Try again." };
    }
  }

  if (selfies.length) {
    await removeObjects(selfies).catch((error) => console.error("could not remove selfies", clubId, error));
  }

  await admin
    .from("club_face_settings")
    .update({
      enabled: false,
      collection_id: null,
      backfill_status: "idle",
      backfill_queued_at: null,
      backfill_completed_at: null,
    })
    .eq("club_id", clubId);

  revalidatePath(`/admin/${ctx.club.handle}/settings`);
  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true, message: "Off. Every faceprint for this club has been deleted." };
}

/**
 * Progress for the admin panel to poll while a backfill is in flight.
 *
 * Read-only and cheap — three counts, no Rekognition — because the panel asks
 * for it every few seconds. Watching a library get worked through is the
 * difference between "it is running" and "nothing is happening", and the
 * first backfill of a real club takes long enough that the difference matters.
 */
export async function faceProgressAction(
  clubId: string,
): Promise<{ total: number; remaining: number; status: string; faces: number; error?: string }> {
  if (!z.uuid().safeParse(clubId).success) return { total: 0, remaining: 0, status: "idle", faces: 0, error: "Not found" };
  const ctx = await managerContext(clubId);
  if (!ctx) return { total: 0, remaining: 0, status: "idle", faces: 0, error: "Not authorised" };

  const progress = await backfillProgress(clubId);
  const { count: faces } = await createAdminClient()
    .from("media_faces")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);
  return { ...progress, faces: faces ?? 0 };
}

/** The "Run now" button: for backfill, and for when something looks stuck. */
export async function runFaceJobsAction(clubId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(clubId).success) return { error: "Not found" };
  const ctx = await managerContext(clubId);
  if (!ctx) return { error: "Not authorised" };

  // Shorter than the cron's budget: this is a button, and nobody wants a
  // four minute spinner. The panel polls, so a big library just takes a few
  // presses, or the next hourly cron, which has the long budget.
  const result = await runFaceJobs({ budgetMs: 60_000 });
  const progress = await backfillProgress(clubId);
  revalidatePath(`/admin/${ctx.club.handle}/settings`);
  return {
    ok: true,
    message: `${result.done} done, ${result.failed} failed. ${progress.remaining.toLocaleString("en-AU")} photos still queued.`,
  };
}

// ---------------------------------------------------------------------------
// Member
// ---------------------------------------------------------------------------

/**
 * Records that a member has seen the notice. Deliberately not consent, and
 * deliberately not a precondition for enrolling: it is the disclosure every
 * member of a face-enabled club is owed, because a faceprint is made of their
 * face whether or not they ever choose to be findable.
 *
 * The member writes their own row — the RLS policy and the column grant are
 * both scoped to `user_id = auth.uid()` and these two columns.
 */
export async function acknowledgeFaceNoticeAction(clubId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(clubId).success) return { error: "Not found" };
  const ctx = await getClubContextById(clubId);
  if (!ctx?.membership) return { error: "Not authorised" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ face_notice_ack_at: new Date().toISOString(), face_notice_version: MEMBER_NOTICE_VERSION })
    .eq("id", ctx.membership.id);
  if (error) return { error: "Could not save that. Try again." };

  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true };
}

const enrolSchema = z.object({
  clubId: z.uuid(),
  consented: z.literal(true),
  consentVersion: z.string().min(1),
});

/**
 * Enrolment. The selfie arrives as JPEG bytes from the browser — not WebP,
 * which is what lib/media/prepare.ts produces everywhere else, because
 * Rekognition takes JPEG and PNG only.
 *
 * It is stored with the service role at faces/{membershipId}/selfie.jpg,
 * outside the clubs/ prefix, so no committee policy can reach it.
 */
export async function enrolFaceAction(clubId: string, selfie: File, consented: boolean): Promise<ActionState> {
  const parsed = enrolSchema.safeParse({ clubId, consented, consentVersion: CONSENT_VERSION });
  if (!parsed.success) return { error: "Tick the consent box to continue." };

  const ctx = await getClubContextById(clubId);
  if (!ctx?.membership) return { error: "Not authorised" };
  // Never take a selfie we cannot process: the job would queue behind a
  // worker that can never run, and the member would wait on "Looking now"
  // indefinitely with their photo already uploaded.
  if (!facesConfigured()) {
    return { error: "Face recognition is not available here yet. Nothing has been saved." };
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("club_face_settings")
    .select("enabled")
    .eq("club_id", clubId)
    .maybeSingle();
  if (!settings?.enabled) return { error: "This club has not turned face recognition on." };

  if (selfie.type !== "image/jpeg") return { error: "That photo could not be read. Try again." };
  if (selfie.size > 8 * 1024 * 1024) return { error: "That photo is too large." };

  const path = selfiePath(ctx.membership.id);
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, selfie, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return { error: "We could not save that photo. Try again." };

  // Re-enrolling replaces the old profile outright, so the previous faceprint
  // is purged rather than left behind alongside the new one.
  const { data: existing } = await admin
    .from("member_face_profiles")
    .select("id")
    .eq("membership_id", ctx.membership.id)
    .maybeSingle();
  if (existing) {
    await admin.from("member_face_profiles").delete().eq("id", existing.id);
    await drainFacePurgeQueue().catch(() => undefined);
  }

  const { data: profile, error } = await admin
    .from("member_face_profiles")
    .insert({
      club_id: clubId,
      membership_id: ctx.membership.id,
      user_id: ctx.userId,
      status: "pending",
      selfie_path: path,
      consent_version: CONSENT_VERSION,
      consented_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !profile) return { error: "Could not save your consent. Try again." };

  await enqueueEnrolJob(clubId, profile.id);
  kickFaceJobs();

  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true, message: "Looking through this club's photos now. This takes a minute." };
}

/**
 * Withdrawing consent. The purge queue is drained inline rather than left to
 * the hourly cron, so the faceprint is gone before the member has left the
 * page, not merely inside the 24 hours the consent copy promises.
 */
export async function withdrawFaceConsentAction(clubId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(clubId).success) return { error: "Not found" };
  const ctx = await getClubContextById(clubId);
  if (!ctx?.membership) return { error: "Not authorised" };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("member_face_profiles")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!profile) return { ok: true, message: "Already off." };

  await revokeProfile(profile.id);
  await drainFacePurgeQueue().catch((error) => console.error("inline purge failed", profile.id, error));

  revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true, message: "Off. Your selfie, faceprint and matches are gone." };
}

/**
 * Yes or no on one suggestion. "Yes" promotes the face to a reference, so the
 * next photo is recognised better. "No" is permanent: it writes a rejection
 * keyed on (profile, photo), which survives a re-index and is consulted
 * before any match is ever written again.
 */
export async function decideFaceMatchAction(matchId: string, decision: "confirm" | "reject"): Promise<ActionState> {
  if (!z.uuid().safeParse(matchId).success) return { error: "Not found" };

  const supabase = await createClient();
  // RLS restricts this select to the caller's own matches, which is also the
  // authorisation check: no row means not yours.
  const { data: match } = await supabase
    .from("face_matches")
    .select("id, club_id, media_id, media_face_id, profile_id, state")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Not found" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("face_matches")
    .update({ state: decision === "confirm" ? "confirmed" : "rejected", decided_at: now })
    .eq("id", match.id);
  if (error) return { error: "Could not save that. Try again." };

  const admin = createAdminClient();
  if (decision === "confirm") {
    await promoteMatchToReference(match.profile_id, match.media_face_id).catch((promoteError) =>
      console.error("could not promote match to reference", match.id, promoteError),
    );
  } else {
    // The durable part. The match row itself cascades away with the face on a
    // re-index; this does not.
    await admin.from("face_rejections").upsert(
      { club_id: match.club_id, profile_id: match.profile_id, media_id: match.media_id },
      { onConflict: "profile_id,media_id", ignoreDuplicates: true },
    );
  }

  const ctx = await getClubContextById(match.club_id);
  if (ctx) revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { ok: true };
}

/**
 * What the "Looking now" card polls while a member's enrolment is pending.
 *
 * It also nudges the queue. The enrol job is kicked when the selfie arrives,
 * but a throttled or timed-out job goes back with a delay and nothing else
 * would pick it up until the next hourly cron. The member is the
 * one person actually waiting, so their open page does the asking: a short
 * drain, enrol jobs first (see claim_face_jobs), and never longer than a
 * request can bear.
 */
export async function enrolStatusAction(clubId: string): Promise<{ status: "none" | "pending" | "ready" | "failed" }> {
  if (!z.uuid().safeParse(clubId).success) return { status: "none" };
  const ctx = await getClubContextById(clubId);
  if (!ctx?.membership) return { status: "none" };

  const read = async () => {
    const { data } = await (await createClient())
      .from("member_face_profiles")
      .select("status")
      .eq("club_id", clubId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    return (data?.status as "pending" | "ready" | "failed" | undefined) ?? "none";
  };

  const before = await read();
  if (before !== "pending" || !facesConfigured()) return { status: before };
  await runFaceJobs({ budgetMs: 12_000, batchSize: 4 }).catch((error) => console.error("enrol nudge failed", error));
  const after = await read();
  if (after !== "pending") revalidatePath(`/c/${ctx.club.handle}`, "layout");
  return { status: after };
}

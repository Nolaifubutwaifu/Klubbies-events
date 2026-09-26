import "server-only";
import { IndexFacesCommand } from "@aws-sdk/client-rekognition";
import { BUCKET, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectionIdFor, faceClient, referenceExternalId } from "./client";
import { MAX_REFERENCES_PER_PROFILE, QUALITY_FILTER } from "./constants";
import { matchClubMedia } from "./match";

export type EnrolResult = { matches: number; failed?: string };

/** The selfie lives outside clubs/, so no club committee can reach it. */
export function selfiePath(membershipId: string): string {
  return `faces/${membershipId}/selfie.jpg`;
}

/**
 * Turns an enrolment selfie into the member's first reference face, then
 * sweeps the club's back catalogue for them. For a member in a few hundred
 * photos this is one search and the whole history appears at once.
 */
export async function enrolProfile(profileId: string): Promise<EnrolResult> {
  const client = faceClient();
  if (!client) return { matches: 0, failed: "aws not configured" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("member_face_profiles")
    .select("id, club_id, membership_id, selfie_path, revoked_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile || profile.revoked_at) return { matches: 0, failed: "profile gone" };
  if (!profile.selfie_path) return await failProfile(profileId, "No selfie was uploaded.");

  const collectionId = collectionIdFor(profile.club_id);
  const { data: blob, error } = await admin.storage.from(BUCKET).download(profile.selfie_path);
  if (error || !blob) return await failProfile(profileId, "We could not read your selfie. Try uploading it again.");

  const indexed = await client.send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: new Uint8Array(await blob.arrayBuffer()) },
      ExternalImageId: referenceExternalId(profile.membership_id),
      QualityFilter: QUALITY_FILTER,
      MaxFaces: 1,
      DetectionAttributes: [],
    }),
  );

  const record = indexed.FaceRecords?.[0];
  // Zero faces back means the photo was unusable. Saying so is better than
  // leaving someone waiting for matches that will never come.
  if (!record?.Face?.FaceId) {
    return await failProfile(
      profileId,
      "We could not find a clear face in that photo. Try again somewhere brighter, facing the camera.",
    );
  }

  const { error: refError } = await admin.from("member_face_references").insert({
    club_id: profile.club_id,
    profile_id: profile.id,
    collection_id: collectionId,
    rekognition_face_id: record.Face.FaceId,
    source: "selfie",
    quality: record.FaceDetail?.Quality?.Sharpness ?? null,
  });
  if (refError) throw refError;

  await admin
    .from("member_face_profiles")
    .update({ status: "ready", failure_reason: null })
    .eq("id", profile.id);

  const matches = await sweepBackCatalogue(profile.club_id, profile.id);
  return { matches };
}

async function failProfile(profileId: string, reason: string): Promise<EnrolResult> {
  await createAdminClient()
    .from("member_face_profiles")
    .update({ status: "failed", failure_reason: reason })
    .eq("id", profileId);
  return { matches: 0, failed: reason };
}

/**
 * Sweeps the club's back catalogue for a member who has just enrolled.
 *
 * This is the per-reference direction of lib/faces/match.ts with the batch set
 * to "every photo in the club", which for one new member is exactly one
 * search. For a member in a few hundred photos the whole history appears at
 * once, for the price of a single call.
 */
async function sweepBackCatalogue(clubId: string, profileId: string): Promise<number> {
  const admin = createAdminClient();
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("media_faces")
      .select("media_id")
      .eq("club_id", clubId)
      .range(from, from + 999);
    if (!data?.length) break;
    for (const row of data) ids.push(row.media_id);
    if (data.length < 1000) break;
  }
  const mediaIds = [...new Set(ids)];
  if (mediaIds.length === 0) return 0;
  const result = await matchClubMedia(clubId, mediaIds);
  void profileId; // matching covers every enrolled member, this one included
  return result.written;
}

/**
 * A confirmed match becomes another reference, so the member is recognised
 * better next time. The faceprint already exists in the collection, so this
 * is a row rather than a second IndexFaces — and the FK means it disappears
 * with the photo it came from.
 */
export async function promoteMatchToReference(profileId: string, mediaFaceId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: face } = await admin
    .from("media_faces")
    .select("id, club_id, media_id, collection_id, rekognition_face_id, sharpness")
    .eq("id", mediaFaceId)
    .maybeSingle();
  if (!face) return;

  const { error } = await admin.from("member_face_references").insert({
    club_id: face.club_id,
    profile_id: profileId,
    collection_id: face.collection_id,
    rekognition_face_id: face.rekognition_face_id,
    media_face_id: face.id,
    media_id: face.media_id,
    source: "confirmed_match",
    quality: face.sharpness,
  });
  // Already a reference: confirming twice is not an error.
  if (error && error.code !== "23505") throw error;

  await trimReferences(profileId);
}

/**
 * Past about ten references a profile fills with near-duplicates from one
 * night: slower to search, no more accurate. The selfie is never trimmed —
 * it is the only face the member actually chose.
 */
async function trimReferences(profileId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: refs } = await admin
    .from("member_face_references")
    .select("id, source, quality, created_at")
    .eq("profile_id", profileId)
    .eq("source", "confirmed_match")
    .order("quality", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!refs) return;

  const keep = Math.max(0, MAX_REFERENCES_PER_PROFILE - 1); // the selfie holds one slot
  const surplus = refs.slice(keep);
  if (surplus.length === 0) return;
  // The delete trigger queues each faceprint for removal from AWS.
  await admin
    .from("member_face_references")
    .delete()
    .in(
      "id",
      surplus.map((ref) => ref.id),
    );
}

/**
 * Withdrawing consent. The profile row cascades to references and matches,
 * the trigger queues every reference faceprint for deletion, and the selfie
 * object goes. The caller drains the purge queue inline so "within 24 hours"
 * is an outer bound rather than a target.
 */
export async function revokeProfile(profileId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("member_face_profiles")
    .select("id, selfie_path")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return;

  await admin.from("member_face_profiles").delete().eq("id", profile.id);
  if (profile.selfie_path) {
    await removeObjects([profile.selfie_path]).catch((error) =>
      console.error("could not remove selfie", profile.id, error),
    );
  }
}

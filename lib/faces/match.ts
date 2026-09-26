import "server-only";
import { SearchFacesCommand } from "@aws-sdk/client-rekognition";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { faceClient, parseExternalId } from "./client";
import { SEARCH_MAX_FACES, SEARCH_THRESHOLD, bandFor } from "./constants";

/**
 * Matching is the expensive half of this feature, and which way round you run
 * it decides the bill.
 *
 * Searching per face costs one call per face in the batch. Searching per
 * reference costs one call per enrolled reference face in the club. Both
 * return the same pairs, because similarity is symmetric — so the only
 * question is which side is smaller.
 *
 *   one photo off an upload:   3 faces vs 120 references  -> search per face
 *   a nightly drain of 500:    1,100 faces vs 120 refs    -> search per reference
 *
 * The second case is the one that would otherwise dominate a real club's
 * costs: on the demo library a photo averaged 2.2 kept faces, so per-face
 * matching made every photo cost about 3.2 Rekognition calls rather than 1.
 */

type FaceRow = { id: string; media_id: string; rekognition_face_id: string; bounding_box: Json };
type Candidate = { profileId: string; mediaFaceId: string; mediaId: string; similarity: number; box: Json };

export type MatchResult = { searches: number; direction: "per-face" | "per-reference" | "none"; written: number };

export async function matchClubMedia(clubId: string, mediaIds: string[]): Promise<MatchResult> {
  const client = faceClient();
  if (!client || mediaIds.length === 0) return { searches: 0, direction: "none", written: 0 };
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("member_face_profiles")
    .select("id, membership_id")
    .eq("club_id", clubId)
    .eq("status", "ready")
    .is("revoked_at", null);
  if (!profiles?.length) return { searches: 0, direction: "none", written: 0 };
  const profileByMembership = new Map(profiles.map((p) => [p.membership_id, p.id]));

  // Every reference face in the club: the enrolment selfies, which carry a
  // `ref:` ExternalImageId, plus the media faces members have confirmed,
  // which kept their original `media:` id and are known only by this table.
  const { data: references } = await admin
    .from("member_face_references")
    .select("profile_id, rekognition_face_id, collection_id")
    .eq("club_id", clubId);
  if (!references?.length) return { searches: 0, direction: "none", written: 0 };
  const profileByFaceId = new Map(references.map((r) => [r.rekognition_face_id, r.profile_id]));
  const collectionId = references[0].collection_id;

  const faces: FaceRow[] = [];
  for (let i = 0; i < mediaIds.length; i += 200) {
    const { data } = await admin
      .from("media_faces")
      .select("id, media_id, rekognition_face_id, bounding_box")
      .eq("club_id", clubId)
      .in("media_id", mediaIds.slice(i, i + 200));
    faces.push(...(data ?? []));
  }
  if (faces.length === 0) return { searches: 0, direction: "none", written: 0 };

  const { data: rejections } = await admin
    .from("face_rejections")
    .select("profile_id, media_id")
    .eq("club_id", clubId)
    .in("media_id", mediaIds.slice(0, 500));
  const rejected = new Set((rejections ?? []).map((r) => `${r.profile_id}:${r.media_id}`));

  const perFace = faces.length <= references.length;
  const candidates: Candidate[] = [];
  let searches = 0;

  if (perFace) {
    for (const face of faces) {
      const found = await client.send(
        new SearchFacesCommand({
          CollectionId: collectionId,
          FaceId: face.rekognition_face_id,
          FaceMatchThreshold: SEARCH_THRESHOLD,
          MaxFaces: SEARCH_MAX_FACES,
        }),
      );
      searches += 1;
      for (const match of found.FaceMatches ?? []) {
        const external = parseExternalId(match.Face?.ExternalImageId);
        const profileId =
          external?.kind === "ref"
            ? profileByMembership.get(external.id)
            : profileByFaceId.get(match.Face?.FaceId ?? "");
        if (!profileId) continue;
        candidates.push({
          profileId,
          mediaFaceId: face.id,
          mediaId: face.media_id,
          similarity: match.Similarity ?? 0,
          box: face.bounding_box,
        });
      }
    }
  } else {
    // The batch is bigger than the club's reference set, so ask the other way
    // round. A search from a reference returns the whole collection, so hits
    // outside this batch are dropped — they were matched when their own batch
    // ran, and the insert is `ignoreDuplicates` anyway.
    const faceById = new Map(faces.map((f) => [f.rekognition_face_id, f]));
    for (const reference of references) {
      const found = await client.send(
        new SearchFacesCommand({
          CollectionId: collectionId,
          FaceId: reference.rekognition_face_id,
          FaceMatchThreshold: SEARCH_THRESHOLD,
          // A reference can legitimately hit hundreds of photos, so this is
          // the one search where the long tail is the point.
          MaxFaces: 4096,
        }),
      );
      searches += 1;
      for (const match of found.FaceMatches ?? []) {
        const face = faceById.get(match.Face?.FaceId ?? "");
        if (!face) continue;
        candidates.push({
          profileId: reference.profile_id,
          mediaFaceId: face.id,
          mediaId: face.media_id,
          similarity: match.Similarity ?? 0,
          box: face.bounding_box,
        });
      }
    }
  }

  // One row per (member, photo), keeping the best face in it.
  const best = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${c.profileId}:${c.mediaId}`;
    if (rejected.has(key)) continue;
    const current = best.get(key);
    if (!current || c.similarity > current.similarity) best.set(key, c);
  }

  const rows = [...best.values()]
    .map((c) => ({ c, band: bandFor(c.similarity) }))
    .filter((r) => r.band !== null)
    .map(({ c, band }) => ({
      club_id: clubId,
      media_id: c.mediaId,
      media_face_id: c.mediaFaceId,
      profile_id: c.profileId,
      similarity: c.similarity,
      bounding_box: c.box,
      state: band as "confirmed" | "suggested",
    }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin
      .from("face_matches")
      .upsert(rows.slice(i, i + 500), { onConflict: "profile_id,media_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  return { searches, direction: perFace ? "per-face" : "per-reference", written: rows.length };
}

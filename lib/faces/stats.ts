// What indexing saw in one photo, as counts only: no faceprints, no boxes.
// Kept on media.face_stats (migration 38) so the floors in constants.ts can be
// tuned on evidence. Shared by the worker and scripts/backfill-faces.ts, so it
// imports nothing that only runs on the server.

type Record_ = {
  Face?: { BoundingBox?: { Width?: number } };
  FaceDetail?: { Quality?: { Sharpness?: number; Brightness?: number } };
};
type Unindexed = { Reasons?: string[] };
type Floors = { minBoundingBoxWidth: number; minSharpness: number; minBrightness: number };

export type FaceStats = {
  v: 1;
  /** Faces stored and searchable. */
  kept: number;
  /** Let go by our own floors. One face can count under more than one. */
  small: number;
  soft: number;
  dark: number;
  /** Refused by Rekognition's quality filter before we saw them, by reason. */
  unindexed: number;
  reasons: Record<string, number>;
};

export function faceStats(kept: Record_[], dropped: Record_[], unindexed: Unindexed[] | undefined, floors: Floors): FaceStats {
  const reasons: Record<string, number> = {};
  for (const face of unindexed ?? []) {
    for (const reason of face.Reasons ?? []) reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return {
    v: 1,
    kept: kept.length,
    small: dropped.filter((r) => (r.Face?.BoundingBox?.Width ?? 0) < floors.minBoundingBoxWidth).length,
    soft: dropped.filter((r) => (r.FaceDetail?.Quality?.Sharpness ?? 0) < floors.minSharpness).length,
    dark: dropped.filter((r) => (r.FaceDetail?.Quality?.Brightness ?? 0) < floors.minBrightness).length,
    unindexed: unindexed?.length ?? 0,
    reasons,
  };
}

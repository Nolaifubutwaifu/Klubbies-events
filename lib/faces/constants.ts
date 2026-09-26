// Every number the matcher depends on, in one file.
//
// Tuned 2026-09-23 against 274 real photos and 335 human-confirmed face names
// (six people photographed inside about a year of each other, which is the
// distribution a club produces). Method and raw numbers are in docs/decisions.md.
//
// The finding that mattered: the similarity threshold is almost irrelevant,
// and the minimum face size does nearly all the work. Recall was flat from 82
// to 94 — but at a 4% size floor there were about 50 cross-person false
// positives, and at 6% there were none, at any threshold.

/**
 * Rekognition's own quality bar, applied inside IndexFaces. HIGH drops faces
 * below its sharpness, brightness and pose thresholds before they are stored,
 * which is most of the "don't label the dark room" requirement.
 */
export const QUALITY_FILTER = "HIGH" as const;

/** Caps cost on crowd shots. The largest faces win. */
export const MAX_FACES_PER_PHOTO = 25;

/**
 * Our own floors, applied after IndexFaces. Faces failing these were already
 * stored, so the worker deletes them again — otherwise we pay to keep
 * faceprints we have decided not to trust.
 */
export const FACE_FLOORS = {
  /**
   * Fraction of image width, and the single most important number here.
   *
   * At 4% a face carries too little signal to be identified but plenty to be
   * confidently wrong: the tuning set produced ~50 cross-person matches, the
   * worst of them a small blurred face at 99.9% similarity against a clear
   * photo of somebody else. At 6% that number is zero, and recall among the
   * faces that remain goes up rather than down.
   *
   * It costs coverage — roughly a fifth of a person's photos have them
   * smaller than this, and those can never match. That is the right trade:
   * the spec's own bias is that a wrong confirmed match costs more trust than
   * a missed one, and the numbers say the same thing loudly.
   */
  minBoundingBoxWidth: 0.06,
  /** Rejects motion blur, which is most of a dancefloor. */
  minSharpness: 20,
  /** Rejects silhouettes and backlit faces. */
  minBrightness: 25,
} as const;

/**
 * SearchFaces similarity, 0 to 100.
 *
 * Left where the spec put them, now with evidence rather than a guess behind
 * them. Once the size floor above is right, 98.5% of genuine matches land at
 * 92 or above, 1% in the suggested band and 0.5% below 85 — so these
 * boundaries cost almost nothing and the suggested band stays as a cheap
 * safety valve for the uncertain 1%.
 */
export const SIMILARITY = {
  /** At or above this, it goes straight into "Photos of you". */
  confirmed: 92,
  /** At or above this but below confirmed, it asks "Is this you?". */
  suggested: 85,
} as const;

/** Below `suggested`, no record is written at all. */
export const SEARCH_THRESHOLD = SIMILARITY.suggested;

/** Candidates per search. Past ten, the tail is all noise. */
export const SEARCH_MAX_FACES = 10;

/**
 * Confirmed matches become reference faces, which is how recognition improves
 * with use. Past about ten the collection fills with near-duplicates from the
 * same night: slower, no more accurate.
 */
export const MAX_REFERENCES_PER_PROFILE = 10;

/** Longest edge of the JPEG sent to Rekognition. Well inside the 5 MB limit. */
export const TRANSCODE_MAX_EDGE = 2000;
export const TRANSCODE_QUALITY = 85;

/** Longest edge and quality for the enrolment selfie. */
export const SELFIE_MAX_EDGE = 1000;
export const SELFIE_QUALITY = 0.9;

/** Jobs claimed per batch, and how many run at once within one. */
export const JOB_BATCH_SIZE = 25;
export const JOB_CONCURRENCY = 8;

/**
 * How long a drain keeps claiming batches before it stops and leaves the rest
 * for the next trigger.
 *
 * The cron route sets maxDuration to 300s, so 240 leaves room to finish the
 * batch in hand, purge and settle without the function being killed
 * mid-write. An upload's after-response kick gets far less: its only job is
 * the photo just uploaded, and it is running inside somebody's request.
 */
export const DRAIN_BUDGET_MS = 240_000;
export const UPLOAD_KICK_BUDGET_MS = 15_000;

/** Five strikes and the job stops burning AWS quota, with the error kept. */
export const MAX_JOB_ATTEMPTS = 5;

/** Face ids per DeleteFaces call. The API cap is higher; this is comfortable. */
export const PURGE_BATCH_SIZE = 1000;

/**
 * Bumped whenever the consent wording changes materially, so we can tell who
 * agreed to which text and re-prompt when it matters.
 */
export const CONSENT_VERSION = "2026-09-23";
export const CLUB_NOTICE_VERSION = "2026-09-23";
/** Bumped with MEMBER_NOTICE; a change re-asks every member to acknowledge. */
export const MEMBER_NOTICE_VERSION = "2026-09-23";

export function bandFor(similarity: number): "confirmed" | "suggested" | null {
  if (similarity >= SIMILARITY.confirmed) return "confirmed";
  if (similarity >= SIMILARITY.suggested) return "suggested";
  return null;
}

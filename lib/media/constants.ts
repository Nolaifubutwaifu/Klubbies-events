export const ACCEPTED_TYPES: Record<string, { kind: "photo" | "video"; ext: string }> = {
  "image/jpeg": { kind: "photo", ext: "jpg" },
  "image/png": { kind: "photo", ext: "png" },
  "image/webp": { kind: "photo", ext: "webp" },
  "image/heic": { kind: "photo", ext: "heic" },
  "image/heif": { kind: "photo", ext: "heic" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
};

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export const ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.heic,.heif,.webp,.mp4,.mov,image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime";

/**
 * Content-Types written to the event_media bucket. The storage allow-list in
 * migration 37 must stay in step with this: gallery originals (including HEIC
 * and tus), WebP or JPEG derivatives, video posters, logos, covers, avatars
 * and face selfies. SVG is intentionally absent.
 */
export const EVENT_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
] as const;

/**
 * Photos stay at 50 MB. A phone photo is well under that. Videos are separate:
 * a 20–30s iPhone clip is often larger than 50 MB, and the load test rejected
 * every one of them. 200 MB covers a normal phone video. The product ceiling
 * is still 500 MB (pricing handoff §4).
 *
 * NEXT_PUBLIC_UPLOAD_MAX_MB overrides the video ceiling only, and is capped at
 * 500. Leave it unset to use 200. It is inlined at build time, so a change in
 * Vercel needs a new deployment. Photos do not follow this variable.
 */
const PRODUCT_MAX_MB = 500;
const VIDEO_DEFAULT_MB = 200;
const configuredMb = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB);
export const PHOTO_MAX_MB = 50;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
export const UPLOAD_MAX_MB =
  Number.isFinite(configuredMb) && configuredMb > 0 ? Math.min(configuredMb, PRODUCT_MAX_MB) : VIDEO_DEFAULT_MB;
export const VIDEO_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024;

/**
 * Supabase resumable uploads require every chunk but the last to be exactly
 * 6 MiB. A 200 MB video is many of these chunks, not one request.
 */
export const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

export type UploadKind = "photo" | "video";

export function maxBytesForKind(kind: UploadKind): number {
  return kind === "photo" ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
}

export function oversizeMessage(kind: UploadKind): string {
  if (kind === "photo") return `Photos can be up to ${PHOTO_MAX_MB} MB.`;
  return `Videos can be up to ${UPLOAD_MAX_MB} MB. Trim the video or export it smaller (on iPhone: Edit, then trim), then try again.`;
}

/** Said before a file is even queued, so nobody waits for an upload that can't finish. */
export function tooBigWarning(name: string, kind: UploadKind): string {
  if (kind === "photo") {
    return `${name} is over ${PHOTO_MAX_MB} MB, so it wasn't added. Photos can be up to ${PHOTO_MAX_MB} MB.`;
  }
  return `${name} is over ${UPLOAD_MAX_MB} MB, so it wasn't added. Videos can be up to ${UPLOAD_MAX_MB} MB: trim the video and add it again.`;
}

/**
 * How a resumable upload splits a file. Every chunk but the last is exactly
 * TUS_CHUNK_BYTES. The last one is shorter when the file is not a multiple.
 */
export function tusChunkPlan(byteSize: number): { chunks: number; fullChunks: number; lastChunkBytes: number } {
  if (byteSize <= 0) return { chunks: 0, fullChunks: 0, lastChunkBytes: 0 };
  const chunks = Math.ceil(byteSize / TUS_CHUNK_BYTES);
  const lastChunkBytes = byteSize - (chunks - 1) * TUS_CHUNK_BYTES;
  return { chunks, fullChunks: chunks - 1, lastChunkBytes };
}

/** Browsers often report HEIC and MOV with an empty type; fall back to the extension. */
export function resolveMimeType(filename: string, reported: string): string | null {
  const type = reported.toLowerCase();
  if (ACCEPTED_TYPES[type]) return type;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

/** An upload still unfinished after this long has stopped, not slowed. */
export const STUCK_AFTER_MS = 60 * 60 * 1000;
/** After this long nobody is coming back for it, and the cron clears it. */
export const EXPIRE_AFTER_DAYS = 14;

/** Rows last touched before this are stalled uploads, not slow ones. */
export function stuckCutoffIso(): string {
  return new Date(Date.now() - STUCK_AFTER_MS).toISOString();
}

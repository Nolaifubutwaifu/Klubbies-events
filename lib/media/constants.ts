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
 * The largest file anyone can upload. The product allows 500 MB (pricing
 * handoff §4), but Storage enforces its own per-file ceiling: 50 MB on the
 * Supabase Free plan. Anything above it was accepted here and then rejected
 * mid-upload with no reason given. Set NEXT_PUBLIC_UPLOAD_MAX_MB to 500 once
 * Storage allows it (Supabase Pro, global limit and bucket limit raised).
 */
const PRODUCT_MAX_MB = 500;
const configuredMb = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB);
export const UPLOAD_MAX_MB = Number.isFinite(configuredMb) && configuredMb > 0 ? Math.min(configuredMb, PRODUCT_MAX_MB) : 50;
export const LARGE_VIDEO_BYTES = UPLOAD_MAX_MB * 1024 * 1024;
export const UPLOAD_MAX_BYTES = LARGE_VIDEO_BYTES;
export const VIDEO_TOO_BIG = `Files can be up to ${UPLOAD_MAX_MB} MB. Trim the video or export it smaller (on iPhone: Edit, then trim), then try again.`;

/** Said before a file is even queued, so nobody waits for an upload that can't finish. */
export function tooBigWarning(name: string): string {
  return `${name} is over ${UPLOAD_MAX_MB} MB, so it wasn't added. Files can be up to ${UPLOAD_MAX_MB} MB: trim the video and add it again.`;
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

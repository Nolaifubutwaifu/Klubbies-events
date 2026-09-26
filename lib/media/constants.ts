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

export const LARGE_VIDEO_BYTES = 500 * 1024 * 1024;

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

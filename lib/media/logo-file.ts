import sharp from "sharp";

// Do not call sharp.block({ operation: ["VipsForeignLoadSvg"] }) from the app.
// The block is process-wide, and next/og rasterises its own SVG for
// opengraph-image. User SVG is refused below, before sharp is called.

/** Same ceiling the uploader enforces. The browser check is not the boundary. */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Album cover uploads (AlbumEditPanel) stop at 10 MB. */
export const COVER_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Sharp's default cap is 268402689 pixels (16383²). A current full-frame file
 * is about 45–61MP — a Sony A7R V frame is 9504×6336 = 60,217,344 — so 40
 * million would reject ordinary camera photos. Gallery indexing uses 80
 * million: it clears that frame and still refuses a small file that claims a
 * far larger canvas.
 *
 * Logos are badges, not camera frames. 25 million is about a 5000px square,
 * which is past any logo we would keep, and stops a small file from claiming
 * a huge canvas inside rasterLogoMark.
 *
 * The face crop route is separate again (CROP_MAX_INPUT_PIXELS). It runs on
 * the request, several at a time, so it does not borrow the gallery cap.
 */
export const GALLERY_MAX_INPUT_PIXELS = 80_000_000;
export const LOGO_MAX_INPUT_PIXELS = 25_000_000;
export const CROP_MAX_INPUT_PIXELS = 40_000_000;

/** Gallery indexing, including the hourly job and scripts/backfill-faces.ts. */
export const sharpDecodeOptions = {
  limitInputPixels: GALLERY_MAX_INPUT_PIXELS,
  failOn: "error" as const,
};

/** Logo badge only. */
export const logoDecodeOptions = {
  limitInputPixels: LOGO_MAX_INPUT_PIXELS,
  failOn: "error" as const,
};

/**
 * Face crops. 40 million pixels is 160 MB of RGBA. Four parallel crops stay
 * around 640 MB of pixel buffers, and under about 1.3 GB if rotate keeps a
 * second buffer, which is the headroom under a 2 GB function.
 */
export const cropDecodeOptions = {
  limitInputPixels: CROP_MAX_INPUT_PIXELS,
  failOn: "error" as const,
};

const RASTER_EXT = /\.(png|jpe?g|webp)$/i;

export function isRasterLogoPath(path: string): boolean {
  return RASTER_EXT.test(path);
}

export function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/** PNG, JPEG or WebP by magic bytes. A renamed SVG does not pass. */
export function isRasterLogo(bytes: Uint8Array): boolean {
  return isPng(bytes) || isJpeg(bytes) || isWebp(bytes);
}

/** ISO-BMFF brands sharp can decode for a HEIC/HEIF original. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

export function isHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return HEIF_BRANDS.has(brand);
}

/**
 * Bytes a photo pipeline may hand to sharp: the gallery's PNG, JPEG, WebP and
 * HEIC/HEIF, and not SVG. Display copies are WebP (JPEG if the browser could
 * not encode WebP). The original is the fallback when that copy is missing.
 */
export function isDecodablePhoto(bytes: Uint8Array): boolean {
  return isRasterLogo(bytes) || isHeic(bytes);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `events/<id>/logo/logo-<digits>.png|jpg|jpeg|webp`, as LogoUploader writes it. */
export function isEventLogoPath(eventId: string, path: string): boolean {
  return new RegExp(`^events/${escapeRegExp(eventId)}/logo/logo-\\d+\\.(png|jpe?g|webp)$`).test(path);
}

/** `events/<eventId>/covers/<albumId>-<digits>.png|jpg|jpeg|webp`. */
export function isAlbumCoverPath(eventId: string, albumId: string, path: string): boolean {
  return new RegExp(`^events/${escapeRegExp(eventId)}/covers/${escapeRegExp(albumId)}-\\d+\\.(png|jpe?g|webp)$`).test(path);
}

/**
 * A storage key removeObjects may be given. `..` climbs out of the prefix,
 * so those keys are left in the bucket rather than deleted.
 */
export function isDeletableStorageKey(path: string, prefix: string): boolean {
  if (prefix.length === 0 || path.length === 0 || path.includes("..")) return false;
  return path.startsWith(prefix);
}

/**
 * SVG/XML sniff for the logo path. Raster magic wins, so a PNG whose metadata
 * happens to contain the characters "<svg" is still a PNG.
 */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  if (bytes.length === 0 || isRasterLogo(bytes)) return false;
  const sample = bytes.subarray(0, 2048);
  let text: string;
  if (sample.length >= 2 && sample[0] === 0xff && sample[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(sample);
  } else if (sample.length >= 2 && sample[0] === 0xfe && sample[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(sample);
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(sample);
  }
  const head = text.replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!doctype") || head.includes("<svg");
}

/** A message when these bytes must not be passed to sharp, otherwise null. */
export function logoRejection(path: string, bytes: Uint8Array): string | null {
  if (!isRasterLogoPath(path) || bytes.byteLength > LOGO_MAX_BYTES || !isRasterLogo(bytes) || looksLikeSvg(bytes)) {
    return "Use a PNG, JPG or WebP logo";
  }
  return null;
}

/** The 96px badge. Callers pass bytes that already cleared logoRejection. */
export async function rasterLogoMark(bytes: Uint8Array, size: number): Promise<Buffer> {
  return sharp(bytes, { ...logoDecodeOptions, density: 300 })
    .resize(size, size, { fit: "cover" })
    .webp({ quality: 88 })
    .toBuffer();
}

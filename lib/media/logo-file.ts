import sharp from "./sharp";

/** Same ceiling the uploader enforces. The browser check is not the boundary. */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

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
  return sharp(bytes, { density: 300 }).resize(size, size, { fit: "cover" }).webp({ quality: 88 }).toBuffer();
}

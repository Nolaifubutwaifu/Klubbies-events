// Zips go out in parts so one request stays inside the function limits.
// Kept apart from lib/media/zip so client components can share the numbers.

/** Files in one part, as before. */
export const ZIP_PART_SIZE = 150;

/**
 * Bytes in one part. At about 10 Mbps, 500 MB takes roughly 400 seconds,
 * inside the 800 second function limit with room for a slow phone.
 */
export const ZIP_PART_BYTES = 500 * 1024 * 1024;

export type ZipSized = { byteSize: number | null };

/**
 * Split in order. A part closes when the next file would pass 150 files or
 * ~500 MB. A single file larger than 500 MB is a part on its own.
 */
export function planZipParts<T extends ZipSized>(items: readonly T[]): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  const flush = () => {
    if (current.length === 0) return;
    parts.push(current);
    current = [];
    bytes = 0;
  };
  for (const item of items) {
    const size = Math.max(0, item.byteSize ?? 0);
    if (current.length > 0 && (current.length >= ZIP_PART_SIZE || bytes + size > ZIP_PART_BYTES)) flush();
    current.push(item);
    bytes += size;
  }
  flush();
  return parts;
}

export type ZipPartSummary = { files: number; bytes: number };

/** Files and total bytes in each part, in order. */
export function zipPartSummaries(items: readonly ZipSized[]): ZipPartSummary[] {
  return planZipParts(items).map((part) => ({
    files: part.length,
    bytes: part.reduce((sum, item) => sum + Math.max(0, item.byteSize ?? 0), 0),
  }));
}

/** How many files each part holds, in order. Empty when there is nothing to zip. */
export function zipPartFileCounts(items: readonly ZipSized[]): number[] {
  return zipPartSummaries(items).map((part) => part.files);
}

/**
 * Files a zip requests ahead of the one being written, and the bytes they may
 * add up to. A file opened ahead sits unread until its turn, and storage drops
 * a connection left idle too long, so big originals get little or no lookahead.
 */
export const ZIP_LOOKAHEAD = 6;
export const ZIP_LOOKAHEAD_BYTES = 25 * 1024 * 1024;

/** Indexes to have requested while file `i` is written: `i` itself, then as many after it as fit. Unknown sizes count as the whole budget. */
export function zipLookahead(sizes: readonly (number | null | undefined)[], i: number): number[] {
  const out = [i];
  let queued = 0;
  for (let ahead = i + 1; ahead < Math.min(sizes.length, i + 1 + ZIP_LOOKAHEAD); ahead++) {
    queued += sizes[ahead] ?? ZIP_LOOKAHEAD_BYTES;
    if (queued > ZIP_LOOKAHEAD_BYTES) break;
    out.push(ahead);
  }
  return out;
}

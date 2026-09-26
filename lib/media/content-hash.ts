// A fingerprint of the original file, taken in the browser before upload, so
// the ticket route can tell "this album already has it" and skip a second
// copy. The first real club had 29 of its first 60 photos twice.

/** Hash every byte up to this size; past it, a sample. */
const FULL_HASH_LIMIT = 96 * 1024 * 1024;
const SAMPLE_BYTES = 8 * 1024 * 1024;

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 of the file. A long video would mean reading gigabytes into memory
 * just to compare it, so anything over ~96 MB hashes its exact size plus the
 * first and last 8 MB instead, prefixed "s:" so the two kinds never collide.
 * Null when the browser can't hash at all: the upload then goes ahead as it
 * always did.
 */
export async function contentHash(file: Blob): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    if (file.size <= FULL_HASH_LIMIT) {
      return hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
    }
    const parts = [
      new TextEncoder().encode(`${file.size}:`),
      new Uint8Array(await file.slice(0, SAMPLE_BYTES).arrayBuffer()),
      new Uint8Array(await file.slice(file.size - SAMPLE_BYTES).arrayBuffer()),
    ];
    const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      joined.set(part, offset);
      offset += part.length;
    }
    return `s:${hex(await crypto.subtle.digest("SHA-256", joined))}`;
  } catch {
    return null;
  }
}

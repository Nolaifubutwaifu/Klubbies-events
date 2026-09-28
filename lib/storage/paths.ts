// Storage names shared by lib/storage and lib/backup, kept apart so neither
// has to import the other.

export const BUCKET = "event_media";

/**
 * The small rendition that sits beside a logo: logo-1727.png → mark-1727.webp.
 * Every badge in the app is 24 to 48px, and they were loading the original
 * upload — one event's was 3936px wide — on every page.
 */
export function logoMarkPath(logoPath: string): string {
  const slash = logoPath.lastIndexOf("/");
  const base = logoPath.slice(slash + 1).replace(/\.[^.]+$/, "").replace(/^logo/, "mark");
  return `${logoPath.slice(0, slash)}/${base}.webp`;
}

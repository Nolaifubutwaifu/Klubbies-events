// EXIF DateTimeOriginal is a wall-clock reading with no time zone. exifr turns
// it into a Date in whatever zone the uploader's browser happens to be in,
// which is how a photo taken at night ended up labelled with a morning time.
// Read the raw string instead and pin it to a zone on purpose.

/** The zone every date and time in the app is shown in (lib/format.ts). */
export const DISPLAY_OFFSET = "+10:00";

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const OFFSET = /^([+-])(\d{2}):?(\d{2})$/;

/**
 * "2026:09:19 18:01:00" plus an optional OffsetTimeOriginal ("+11:00") to an
 * ISO instant. With no offset the reading is taken as display-zone wall-clock
 * time, so the viewer shows the same 6:01 pm the camera did.
 */
export function exifToIso(raw: unknown, offset?: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = EXIF_DATE.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  if (y === "0000" || mo === "00" || d === "00") return null; // cameras with no clock set
  const zone = typeof offset === "string" && OFFSET.test(offset.trim()) ? normaliseOffset(offset.trim()) : DISPLAY_OFFSET;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${zone}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normaliseOffset(offset: string): string {
  const [, sign, hh, mm] = OFFSET.exec(offset)!;
  return `${sign}${hh}:${mm}`;
}

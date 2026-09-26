/** An album's anniversary, for the "one year ago tonight" card. */
export type Anniversary<T> = { album: T; years: number };

type Datedish = { date: string; photoCount: number; videoCount: number };

/** Parses an event date, treating a bare YYYY-MM-DD as local midday. */
function eventDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+10:00` : value);
}

/**
 * The album whose anniversary is closest to `today`, at least a year back.
 * Three days of slack either side, so "one year ago" still fires when the ball
 * was on the Saturday and you open the app on the Monday. Empty albums are
 * skipped — a memory card with nothing behind it is worse than none.
 */
export function findAnniversary<T extends Datedish>(albums: T[], today = new Date()): Anniversary<T> | null {
  let best: { album: T; years: number; drift: number } | null = null;

  for (const album of albums) {
    if (album.photoCount + album.videoCount === 0) continue;
    const then = eventDate(album.date);
    const years = today.getFullYear() - then.getFullYear();
    if (years < 1) continue;
    // The same calendar day this year, then how far that is from today.
    const thisYear = new Date(today.getFullYear(), then.getMonth(), then.getDate());
    const drift = Math.abs(Math.round((thisYear.getTime() - today.getTime()) / 86_400_000));
    if (drift > 3) continue;
    if (!best || drift < best.drift || (drift === best.drift && years < best.years)) {
      best = { album, years, drift };
    }
  }

  return best ? { album: best.album, years: best.years } : null;
}

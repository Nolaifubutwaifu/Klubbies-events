// Short months are spelled out here rather than left to Intl: Node says
// "Sept" for en-AU and Safari says "Sep", and that one letter made React throw
// away every server-rendered page with a date on it on iPhones.
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const partsFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Australia/Brisbane" });

function dayMonthYear(date: Date): { day: string; month: string; year: string } {
  const parts = Object.fromEntries(partsFmt.formatToParts(date).map((part) => [part.type, part.value]));
  return { day: String(Number(parts.day)), month: SHORT_MONTHS[Number(parts.month) - 1], year: parts.year };
}
const longDateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" });
// Every formatter names its zone. The server renders in UTC on Vercel, so a
// bare toLocaleTimeString() there turned a 6pm photo into "8:01 am".
const timeFmt = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" });

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Plain dates (album_date) are calendar days, not instants.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+10:00`) : new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const { day, month, year } = dayMonthYear(toDate(value));
  return `${day} ${month} ${year}`;
}

/** "23 Sep": for places where the year goes without saying. */
export function formatDayMonth(value: string | Date | null | undefined): string {
  if (!value) return "";
  const { day, month } = dayMonthYear(toDate(value));
  return `${day} ${month}`;
}

export function formatLongDate(value: string | Date | null | undefined): string {
  return value ? longDateFmt.format(toDate(value)) : "";
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = toDate(value);
  const { day, month } = dayMonthYear(date);
  return `${day} ${month}, ${timeFmt.format(date)}`;
}

export function formatTime(value: string | Date | null | undefined): string {
  return value ? timeFmt.format(toDate(value)) : "";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-AU")} ${count === 1 ? one : many}`;
}

const dayFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "Australia/Brisbane" });

/**
 * An event's dates as people say them: "14 Nov 2026", "14–15 Nov 2026",
 * "30 Nov – 2 Dec 2026". Empty when the event has no date.
 */
export function formatEventDates(startsOn: string | null | undefined, endsOn: string | null | undefined): string {
  if (!startsOn) return endsOn ? formatDate(endsOn) : "";
  if (!endsOn || endsOn === startsOn) return formatDate(startsOn);
  const start = toDate(startsOn);
  const end = toDate(endsOn);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) return `${dayFmt.format(start)}–${formatDate(end)}`;
  if (sameYear) return `${formatDayMonth(start)} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/**
 * A `datetime-local` value ("2026-10-09T09:00") read as Brisbane time, the
 * zone every date in the app is shown in. Values that already carry an
 * offset are kept as they are. Returns null for anything unreadable.
 */
export function brisbaneInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const zoned = /(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)
    ? trimmed
    : `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}+10:00`;
  const when = new Date(zoned);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

/** The reverse: an instant as a Brisbane `datetime-local` value. */
export function isoToBrisbaneInput(iso: string | null): string {
  if (!iso) return "";
  const when = new Date(new Date(iso).getTime() + 10 * 3600 * 1000);
  return when.toISOString().slice(0, 16);
}

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Brisbane" });
const longDateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" });
const dateTimeFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Brisbane",
});
// Every formatter names its zone. The server renders in UTC on Vercel, so a
// bare toLocaleTimeString() there turned a 6pm photo into "8:01 am".
const timeFmt = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" });

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Plain dates (album_date) are calendar days, not instants.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+10:00`) : new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  return value ? dateFmt.format(toDate(value)) : "";
}

export function formatLongDate(value: string | Date | null | undefined): string {
  return value ? longDateFmt.format(toDate(value)) : "";
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return value ? dateTimeFmt.format(toDate(value)) : "";
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
const dayMonthFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Brisbane" });

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
  if (sameYear) return `${dayMonthFmt.format(start)} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

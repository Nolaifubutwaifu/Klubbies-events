/* eslint-disable @next/next/no-img-element -- short-lived signed URL */

export function eventInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A event's badge, the same everywhere it appears: the logo when there is
 * one, otherwise its initials on the event's own colour. The rail, the phone
 * switcher and the profile each used to draw their own, so one event showed up
 * red in one place, as a black square in another and as bare initials on a
 * third.
 */
export function EventMark({
  name,
  logoUrl,
  accentColour,
  size = 32,
}: {
  name: string;
  logoUrl?: string | null;
  accentColour?: string | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center overflow-hidden font-extrabold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.34),
        fontSize: Math.max(10, Math.round(size * 0.34)),
        background: logoUrl ? "transparent" : (accentColour ?? "var(--color-accent)"),
      }}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : eventInitials(name)}
    </span>
  );
}

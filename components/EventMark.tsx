/* eslint-disable @next/next/no-img-element -- short-lived signed URL */

/** "Brisbane Product Summit 2026" is BP: words, not years or numbers. */
export function eventInitials(name: string): string {
  const all = name.trim().split(/\s+/).filter(Boolean);
  const words = all.filter((w) => /^\p{L}/u.test(w));
  const parts = words.length ? words : all;
  if (!parts.length) return "??";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * An event's badge, the same everywhere it appears: the logo on white when
 * there is one, otherwise its initials on the event's own colour.
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
      className="flex flex-none items-center justify-center overflow-hidden font-semibold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, Math.round(size * 0.22)),
        fontSize: Math.max(11, Math.round(size * 0.36)),
        background: logoUrl ? "#fff" : (accentColour ?? "var(--kb-ink)"),
        boxShadow: logoUrl ? "inset 0 0 0 1px var(--kb-line)" : undefined,
      }}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain p-[12%]" /> : eventInitials(name)}
    </span>
  );
}

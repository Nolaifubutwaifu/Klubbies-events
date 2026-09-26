// Per-club tone. Klubbies' ember is fixed brand — it carries headline
// emphasis, tags, eyebrows and the tier-2 button in every club. What a club
// picks is its *quiet* layer: the tier-3 button, the accessory labels and the
// supporting surfaces. Settings stores one hex value and these three tokens
// are mixed from it.

const DEFAULT_ACCENT = "#cf2e12";

export const ACCENT_SWATCHES = [
  "#cf2e12",
  "#c2410c",
  "#b45309",
  "#15803d",
  "#0f766e",
  "#1d4ed8",
  "#4338ca",
  "#7e22ce",
  "#be123c",
  "#2d2b2b",
];

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parse(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function mix(rgb: [number, number, number], target: [number, number, number], amount: number): string {
  return toHex([
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  ]);
}

export function isValidAccent(hex: string | null | undefined): boolean {
  return Boolean(hex && parse(hex));
}

/**
 * Builds the supporting tones for a club. Returns undefined when the club has
 * not picked one, so those pages fall back to the neutral sand in the
 * stylesheet. The club's colour never touches --color-accent: the red is
 * Klubbies' own and stays the same in every club.
 *
 * Each token mixes the club's hue into sand, line or ink, so a club's colour
 * shows in avatars and quiet surfaces while ember stays the only accent.
 */
export function clubToneStyle(hex: string | null | undefined): Record<string, string> | undefined {
  if (!hex) return undefined;
  const rgb = parse(hex);
  if (!rgb) return undefined;
  // Mixed into sand and ink rather than lilac: the club's hue tints the quiet
  // layer without adding a new colour family beside ember.
  const sand: [number, number, number] = [248, 238, 233];
  const line: [number, number, number] = [234, 221, 215];
  const ink: [number, number, number] = [43, 34, 40];
  return {
    "--tone-support": mix(rgb, sand, 0.88),
    "--tone-support-deep": mix(rgb, line, 0.8),
    "--tone-support-ink": mix(rgb, ink, 0.75),
  } as Record<string, string>;
}

export { DEFAULT_ACCENT };

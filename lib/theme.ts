// Per-event brand colour. On an event's pages the organiser's colour becomes
// the accent: links, active navigation, chips, checked controls and the focus
// ring. Primary buttons stay ink everywhere, so a client's neon brand can't
// make an action unreadable. The colour is darkened until it clears 4.5:1 on
// white, because it is used for text.

const DEFAULT_ACCENT = "#2b4acb";

export const ACCENT_SWATCHES = [
  "#2b4acb",
  "#0f62fe",
  "#0e7490",
  "#047857",
  "#4d7c0f",
  "#b45309",
  "#c2410c",
  "#be123c",
  "#7e22ce",
  "#16181d",
];

/** What a screen reader says for each swatch, instead of a hex code. */
export const SWATCH_NAMES: Record<string, string> = {
  "#2b4acb": "Klubbies blue",
  "#0f62fe": "Bright blue",
  "#0e7490": "Teal",
  "#047857": "Green",
  "#4d7c0f": "Olive",
  "#b45309": "Amber",
  "#c2410c": "Orange",
  "#be123c": "Red",
  "#7e22ce": "Purple",
  "#16181d": "Ink",
};

type Rgb = [number, number, number];

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parse(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function mix(rgb: Rgb, target: Rgb, amount: number): Rgb {
  return [
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  ];
}

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = clamp(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const INK: Rgb = [22, 24, 29];
const PAPER: Rgb = [247, 247, 245];

/** Steps the colour toward ink until it reaches the ratio on white. */
function darkenUntil(rgb: Rgb, ratio: number): Rgb {
  let out = rgb;
  for (let i = 0; i < 40 && contrast(out, WHITE) < ratio; i++) out = mix(out, INK, 0.06);
  return out;
}

export function isValidAccent(hex: string | null | undefined): boolean {
  return Boolean(hex && parse(hex));
}

/** The accent an event's pages will actually use, after the contrast fix. */
export function readableAccent(hex: string | null | undefined): string {
  const rgb = (hex && parse(hex)) || parse(DEFAULT_ACCENT)!;
  return toHex(darkenUntil(rgb, 4.5));
}

/**
 * CSS variables for an event's pages. Undefined when the event has no colour,
 * so the stylesheet's default blue applies.
 */
export function eventToneStyle(hex: string | null | undefined): Record<string, string> | undefined {
  if (!hex) return undefined;
  const rgb = parse(hex);
  if (!rgb) return undefined;
  const accent = darkenUntil(rgb, 4.5);
  const deep = toHex(darkenUntil(mix(accent, INK, 0.25), 7));
  const tint = toHex(mix(rgb, WHITE, 0.88));
  const base = toHex(accent);
  // The --color-accent aliases are resolved where they are declared (:root),
  // so overriding --kb-ember alone would not reach the Tailwind accent
  // utilities. They are restated here, on the element that carries the style.
  return {
    "--kb-ember": base,
    "--kb-ember-deep": deep,
    "--kb-ember-tint": tint,
    "--color-accent": base,
    "--color-accent-100": tint,
    "--color-accent-200": tint,
    "--color-accent-500": base,
    "--color-accent-600": deep,
    "--color-accent-700": deep,
    "--color-accent-800": deep,
    "--kb-ember-on-dark": toHex(mix(rgb, WHITE, 0.62)),
    "--tone-support": toHex(mix(rgb, PAPER, 0.9)),
    "--tone-support-deep": toHex(mix(rgb, PAPER, 0.8)),
    "--tone-support-ink": toHex(darkenUntil(mix(rgb, INK, 0.55), 7)),
  } as Record<string, string>;
}

export { DEFAULT_ACCENT };

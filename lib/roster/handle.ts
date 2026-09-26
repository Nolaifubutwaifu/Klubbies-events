const MAX_LENGTH = 40;

const TRANSLITERATIONS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
};

/**
 * Derives the club handle base from its name (masterfile §7.1): lowercase,
 * strip accents, collapse anything that is not a letter or digit into a
 * single underscore, trim underscores, truncate to 40 characters at a word
 * boundary. Collision suffixes (_2, _3, ...) are added by create_club().
 */
export function generateHandleBase(name: string): string {
  const ascii = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ßæœøđðłþ]/g, (ch) => TRANSLITERATIONS[ch] ?? "");

  const base = ascii.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) return "club";
  if (base.length <= MAX_LENGTH) return base;

  const window = base.slice(0, MAX_LENGTH + 1);
  const boundary = window.lastIndexOf("_");
  const truncated = boundary > 0 ? window.slice(0, boundary) : base.slice(0, MAX_LENGTH);
  return truncated.replace(/_+$/g, "");
}

export function clubUrl(appUrl: string, handle: string): string {
  return `${appUrl.replace(/\/$/, "")}/c/${handle}`;
}

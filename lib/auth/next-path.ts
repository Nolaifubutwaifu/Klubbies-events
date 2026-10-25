/**
 * Where to go after signing in. A link that needed a sign-in (an album from
 * an email, the deletion email's export page) is remembered in a short-lived
 * cookie by the proxy and used once the code or password is accepted.
 */
export const NEXT_COOKIE = "kb_next";
export const NEXT_COOKIE_MAX_AGE = 30 * 60;

/**
 * Browsers drop tab, CR and LF, and read "/\" as "//", so a value like
 * "/\t/evil.com" is an off-site redirect. Percent-encoding hides the same
 * characters (%09, %2f, %5c), including a second layer (%252f).
 */
const UNSAFE = /[\u0000-\u001F\u007F\s\\]/;
/** Encoded separators in the pathname only. A query may contain `%2F`. */
const ENCODED_UNSAFE = /%(?:25)*(?:2f|5c|[01][0-9a-f]|7f)/i;
const ENCODED_AT = /%(?:25)*40/i;
/** Case-insensitive. `#` ends the path the same way `?` and the end do. */
const SIGN_IN = /^\/(signin|start|api\/auth)(\/|\?|#|$)/i;

function startsWithSingleSlash(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function pathPortion(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

/**
 * Pathname only, with one percent-decode so `/%73ignin` is `/signin`.
 * A broken escape (`/start%`, `/%73ignin/%ff`) cannot be checked, so it is refused.
 */
function decodedPathname(value: string): string | null {
  const path = pathPortion(value);
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

/** "/@evil.com" and "/%40evil.com" put a host in the path as userinfo. */
function pathHasUserinfo(value: string): boolean {
  const path = pathPortion(value);
  return path.includes("@") || ENCODED_AT.test(path);
}

function blocked(value: string): boolean {
  const path = pathPortion(value);
  const decoded = decodedPathname(value);
  if (decoded === null) return true;
  return (
    UNSAFE.test(value) ||
    !startsWithSingleSlash(value) ||
    pathHasUserinfo(value) ||
    ENCODED_UNSAFE.test(path) ||
    SIGN_IN.test(decoded)
  );
}

/** Only same-origin paths, and never back into the sign-in flow itself. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  if (blocked(value)) return null;

  let url: URL;
  try {
    url = new URL(value, "https://x.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://x.invalid") return null;

  // Dot-segments can leave a protocol-relative pathname ("/.//evil.com" →
  // "//evil.com") while the origin stays the base. Reject that result too.
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (blocked(next)) return null;
  return next;
}

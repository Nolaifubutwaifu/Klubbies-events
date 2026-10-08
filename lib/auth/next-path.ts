/**
 * Where to go after signing in. A link that needed a sign-in (an album from
 * an email, the deletion email's export page) is remembered in a short-lived
 * cookie by the proxy and used once the code or password is accepted.
 */
export const NEXT_COOKIE = "kb_next";
export const NEXT_COOKIE_MAX_AGE = 30 * 60;

/** Only same-origin paths, and never back into the sign-in flow itself. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/^\/(signin|start|api\/auth)(\/|\?|$)/.test(value)) return null;
  return value;
}

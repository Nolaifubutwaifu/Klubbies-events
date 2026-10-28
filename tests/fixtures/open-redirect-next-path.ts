/**
 * Copy of lib/auth/next-path.ts from PR #34 (cursor/fix-signin-open-redirect-7697)
 * at 9c4fe8d, for the combination test only. This PR does not change the app's
 * next-path.ts.
 */

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

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (blocked(next)) return null;
  return next;
}

const UNSAFE = /[\u0000-\u001F\u007F\s\\]/;
const ENCODED_UNSAFE = /%(?:25)*(?:2f|5c|[01][0-9a-f]|7f)/i;
const ENCODED_AT = /%(?:25)*40/i;
const SIGN_IN = /^\/(signin|start|api\/auth)(\/|\?|$)/;

function startsWithSingleSlash(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function pathPortion(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

function pathHasUserinfo(value: string): boolean {
  const path = pathPortion(value);
  return path.includes("@") || ENCODED_AT.test(path);
}

function blocked(value: string): boolean {
  return UNSAFE.test(value) || !startsWithSingleSlash(value) || pathHasUserinfo(value) || ENCODED_UNSAFE.test(value) || SIGN_IN.test(value);
}

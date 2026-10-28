import { safeNextPath } from "./next-path";

/** Where a new account types a name, after the email code has been accepted. */
export const NAME_STEP_PATH = "/signin/name";

/**
 * Where to send the browser after the code is accepted.
 * The name step is one exact path. It must not go through safeNextPath:
 * that check rejects /signin/*, and a client that then falls back to /events
 * makes the proxy overwrite the return path the new account was keeping.
 * Every other destination does go through it.
 */
export function pathAfterVerify(body: { redirectTo?: string | null; needsName?: boolean }): string {
  if (body.needsName || body.redirectTo === NAME_STEP_PATH) return NAME_STEP_PATH;
  return safeNextPath(body.redirectTo) ?? "/events";
}

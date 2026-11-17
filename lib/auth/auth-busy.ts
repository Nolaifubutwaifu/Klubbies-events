// Supabase Auth sees every guest as the Vercel server's address, so a short
// burst at the door (10 phones within a second) can trip its per-second limit
// even though the 5 minute totals are far below what the dashboard allows.
// The 17 Nov 2026 load test lost 9 of 150 sign-ins that way. A refused request
// never reached the code check, so trying again a moment later is safe and
// doesn't use up the code.
//
// No server-only import: unit tests load this file directly.

import { sleep } from "@/lib/retry";

/** Shown when Supabase is still refusing after every retry. Not counted as a wrong code. */
export const AUTH_BUSY = "Lots of people are signing in right now. Wait a few seconds and tap Continue again.";

/** Retries after the first try. About 0.8 s, 1.6 s and 2.4 s, plus up to 0.4 s each: 6 s at most. */
export const AUTH_BUSY_RETRIES = 3;

export function authBusyDelayMs(retryIndex: number, random: () => number = Math.random): number {
  const base = 800 * (retryIndex + 1);
  return Math.round(base + random() * 400);
}

/** Supabase Auth's "slow down": HTTP 429, or its rate limit error codes. */
export function isAuthRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; code?: unknown };
  if (e.status === 429) return true;
  return typeof e.code === "string" && /^over_.*rate_limit$/.test(e.code);
}

/**
 * Runs a Supabase Auth call, and again after a short wait while Supabase
 * answers "rate limited". Any other answer, right or wrong, comes back at
 * once. `busy` is true when the last answer was still a rate limit.
 */
export async function withAuthRetry<R extends { error: unknown }>(
  run: () => Promise<R>,
  opts?: { retries?: number; delayMs?: (retryIndex: number) => number; sleep?: (ms: number) => Promise<void> },
): Promise<R & { busy: boolean }> {
  const retries = opts?.retries ?? AUTH_BUSY_RETRIES;
  const delayMs = opts?.delayMs ?? authBusyDelayMs;
  const wait = opts?.sleep ?? sleep;
  let result = await run();
  for (let i = 0; i < retries && isAuthRateLimited(result.error); i++) {
    await wait(delayMs(i));
    result = await run();
  }
  return { ...result, busy: isAuthRateLimited(result.error) };
}

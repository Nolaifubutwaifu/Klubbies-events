// Shared by the browser upload queues and the mailer. No server-only import:
// the queues run in the client bundle.

export const RETRY_ATTEMPTS = 4;

/**
 * Wait before the 2nd, 3rd and 4th attempt: 2s, 6s and 18s, plus up to 25%
 * jitter. Four attempts then span about 30 seconds.
 */
export function exponentialDelayMs(retryIndex: number, random: () => number = Math.random): number {
  const base = 2_000 * 3 ** retryIndex;
  return Math.round(base + random() * base * 0.25);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as { status?: unknown; statusCode?: unknown };
  const raw = record.status ?? record.statusCode;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) ? n : null;
}

/**
 * Upload and finalize: network failures, 5xx and Supabase's 544 (storage RLS
 * timed out talking to Postgres) are worth another try. A 4xx is the server
 * refusing the file — full, wrong type, not uploaded yet — and retrying it
 * won't change the answer.
 */
export function isUploadRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === 544 || (status !== null && status >= 500)) return true;
  if (status !== null && status >= 400 && status < 500) return false;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/\b544\b/.test(text) || /timed out/i.test(text)) return true;
  if (/\b4\d\d\b/.test(text)) return false;
  return /network|failed to fetch|fetch failed|offline|timeout|econnreset|etimedout|socket|aborted/i.test(text);
}

/**
 * The connection dropped, rather than the server refusing. Locking the phone
 * or switching apps pauses the page, and whatever was in flight fails like
 * this: worth starting again by itself when the member is back. A TUS error
 * with no response, or a 5xx, is the same thing; a 4xx is a refusal.
 */
export function isConnectionDrop(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error && typeof error === "object" && "originalRequest" in error) {
    const res = (error as { originalResponse?: { getStatus(): number } | null }).originalResponse;
    if (!res) return true;
    const status = res.getStatus();
    return status === 0 || status >= 500;
  }
  const text = error instanceof Error ? error.message : String(error);
  return isUploadRetryable(error) || /load failed|network connection was lost/i.test(text);
}

/**
 * Resend: only a definite 429 or 5xx. A network error has no status, and
 * retrying it can deliver the same sign-in code twice.
 */
export function isEmailRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 429 || status === 544 || (status !== null && status >= 500);
}

/** The sign-in subject starts with the code. Logs must not keep it. */
export function emailLogLabel(subject: string): string {
  return subject.replace(/^\d{6,10}\b/, "[code]");
}

/** Shorter than the upload schedule: a sign-in code should not sit for half a minute. */
export function emailDelayMs(retryIndex: number, random: () => number = Math.random): number {
  const base = 1_000 * 2 ** retryIndex;
  return Math.round(base + random() * base * 0.25);
}

/** POST JSON, retrying network errors, 5xx and 544. A 4xx response is returned as-is. */
export function postJson(
  url: string,
  body: unknown,
  onRetry?: (nextAttempt: number, attempts: number) => void,
): Promise<Response> {
  return withBackoff(
    async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok && (res.status === 544 || res.status >= 500)) {
        throw Object.assign(new Error(`${res.status}`), { status: res.status });
      }
      return res;
    },
    isUploadRetryable,
    { onRetry },
  );
}

export async function withBackoff<T>(
  run: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  opts?: {
    attempts?: number;
    delayMs?: (retryIndex: number) => number;
    sleep?: (ms: number) => Promise<void>;
    /** nextAttempt is 2 on the first retry: "Trying again (2 of 4)". */
    onRetry?: (nextAttempt: number, attempts: number) => void;
  },
): Promise<T> {
  const attempts = opts?.attempts ?? RETRY_ATTEMPTS;
  const delayMs = opts?.delayMs ?? exponentialDelayMs;
  const wait = opts?.sleep ?? sleep;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      opts?.onRetry?.(attempt + 2, attempts);
      await wait(delayMs(attempt));
    }
  }
  throw last;
}

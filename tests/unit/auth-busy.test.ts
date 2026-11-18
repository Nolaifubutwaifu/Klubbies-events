import { describe, expect, it, vi } from "vitest";
import { authBusyDelayMs, isAuthRateLimited, withAuthRetry } from "@/lib/auth/auth-busy";

const limited = { status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" };
const wrongCode = { status: 403, code: "otp_expired", message: "Token has expired or is invalid" };
const noWait = { sleep: () => Promise.resolve() };

describe("Supabase Auth rate limit retry", () => {
  it("recognises 429 and Supabase's rate limit codes, nothing else", () => {
    expect(isAuthRateLimited(limited)).toBe(true);
    expect(isAuthRateLimited({ code: "over_email_send_rate_limit" })).toBe(true);
    expect(isAuthRateLimited({ status: 429 })).toBe(true);
    expect(isAuthRateLimited(wrongCode)).toBe(false);
    expect(isAuthRateLimited({ status: 500 })).toBe(false);
    expect(isAuthRateLimited(null)).toBe(false);
  });

  it("waits 10 seconds at most across all retries", () => {
    const most = [0, 1, 2, 3].map((i) => authBusyDelayMs(i, () => 1)).reduce((a, b) => a + b, 0);
    expect([0, 1, 2, 3].map((i) => authBusyDelayMs(i, () => 0))).toEqual([800, 1_600, 2_400, 3_200]);
    expect(most).toBeLessThanOrEqual(10_000);
  });

  it("tries again while rate limited and returns the first real answer", async () => {
    const run = vi
      .fn<() => Promise<{ data: { user: { id: string } | null }; error: unknown }>>()
      .mockResolvedValueOnce({ data: { user: null }, error: limited })
      .mockResolvedValueOnce({ data: { user: null }, error: limited })
      .mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    const result = await withAuthRetry(run, noWait);
    expect(run).toHaveBeenCalledTimes(3);
    expect(result.busy).toBe(false);
    expect(result.data.user?.id).toBe("u1");
  });

  it("returns a wrong code at once, without retrying", async () => {
    const run = vi.fn().mockResolvedValue({ data: { user: null }, error: wrongCode });
    const result = await withAuthRetry(run, noWait);
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.busy).toBe(false);
    expect(result.error).toBe(wrongCode);
  });

  it("gives up after 4 retries and says it was busy", async () => {
    const run = vi.fn().mockResolvedValue({ data: { user: null }, error: limited });
    const waits: number[] = [];
    const result = await withAuthRetry(run, { sleep: async (ms) => void waits.push(ms), delayMs: (i) => i });
    expect(run).toHaveBeenCalledTimes(5);
    expect(waits).toEqual([0, 1, 2, 3]);
    expect(result.busy).toBe(true);
  });
});

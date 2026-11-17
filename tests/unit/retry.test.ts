import { describe, expect, it, vi } from "vitest";
import { emailDelayMs, emailLogLabel, exponentialDelayMs, isEmailRetryable, isUploadRetryable, withBackoff } from "@/lib/retry";

describe("upload retry schedule", () => {
  it("spaces four attempts over about 30 seconds", () => {
    const waits = [0, 1, 2].map((i) => exponentialDelayMs(i, () => 0));
    expect(waits).toEqual([2_000, 6_000, 18_000]);
    const withJitter = [0, 1, 2].map((i) => exponentialDelayMs(i, () => 1));
    expect(withJitter.reduce((sum, n) => sum + n, 0)).toBeGreaterThan(30_000);
    expect(withJitter.reduce((sum, n) => sum + n, 0)).toBeLessThan(40_000);
  });

  it("retries network errors, 5xx and 544, and not 4xx", () => {
    expect(isUploadRetryable(Object.assign(new Error("no"), { status: 544 }))).toBe(true);
    expect(isUploadRetryable(Object.assign(new Error("down"), { statusCode: "503" }))).toBe(true);
    expect(isUploadRetryable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isUploadRetryable(new Error("connection to the database timed out"))).toBe(true);
    expect(isUploadRetryable(Object.assign(new Error("full"), { status: 409 }))).toBe(false);
    expect(isUploadRetryable(Object.assign(new Error("no"), { status: 400 }))).toBe(false);
    expect(isUploadRetryable(Object.assign(new Error("slow down"), { status: 429 }))).toBe(false);
    expect(isUploadRetryable(new Error("413 payload too large"))).toBe(false);
  });
});

describe("email retry", () => {
  it("retries 429 and 5xx only", () => {
    expect(isEmailRetryable(Object.assign(new Error("rate"), { statusCode: 429 }))).toBe(true);
    expect(isEmailRetryable(Object.assign(new Error("down"), { statusCode: 500 }))).toBe(true);
    expect(isEmailRetryable(new TypeError("fetch failed"))).toBe(false);
    expect(isEmailRetryable(Object.assign(new Error("bad address"), { statusCode: 422 }))).toBe(false);
    expect(isEmailRetryable(Object.assign(new Error("no"), { statusCode: 400 }))).toBe(false);
  });

  it("does not put a sign-in code in the log label", () => {
    expect(emailLogLabel("482193 is your code for Club Night")).toBe("[code] is your code for Club Night");
    expect(emailLogLabel("Your photos from Club Night are ready")).toBe("Your photos from Club Night are ready");
  });

  it("backs off without the upload's 30 second budget", () => {
    const total = [0, 1, 2].map((i) => emailDelayMs(i, () => 0)).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(1_000 + 2_000 + 4_000);
  });
});

describe("withBackoff", () => {
  it("stops on a hard failure and retries a transient one", async () => {
    const sleep = vi.fn(async () => undefined);
    const hard = vi.fn(async () => {
      throw Object.assign(new Error("no"), { status: 400 });
    });
    await expect(withBackoff(hard, isUploadRetryable, { sleep })).rejects.toThrow("no");
    expect(hard).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();

    let tries = 0;
    const soft = vi.fn(async () => {
      tries += 1;
      if (tries < 3) throw Object.assign(new Error("down"), { status: 503 });
      return "ok";
    });
    await expect(withBackoff(soft, isUploadRetryable, { sleep })).resolves.toBe("ok");
    expect(soft).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after four attempts", async () => {
    const sleep = vi.fn(async () => undefined);
    const run = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(withBackoff(run, isUploadRetryable, { sleep })).rejects.toThrow(/fetch/i);
    expect(run).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });
});

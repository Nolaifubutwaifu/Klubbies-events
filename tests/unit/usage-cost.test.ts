import { describe, expect, it } from "vitest";
import { estimateCost } from "@/lib/usage/cost";

const MB = 1024 ** 2;

describe("cost estimate", () => {
  it("matches the retention handoff's storage figures for a full Medium event", () => {
    // 4,000 photos of 10 MB, all backed up: A$15.72 Supabase and A$11.98 R2 in the handoff.
    const cost = estimateCost({ originalBytes: 4000 * 10 * MB, backedUpBytes: 4000 * 10 * MB, faceCalls: 0, views: 0, paidAud: 0 });
    expect(cost.storageAud).toBeCloseTo(15.72, 0);
    expect(cost.backupAud).toBeCloseTo(11.98, 0);
    expect(cost.margin).toBeNull();
  });

  it("adds face search and Stripe, and gives a margin on what was paid", () => {
    const cost = estimateCost({ originalBytes: 0, backedUpBytes: 0, faceCalls: 1000, views: 0, paidAud: 59 });
    expect(cost.faceAud).toBe(1.5);
    expect(cost.stripeAud).toBeCloseTo(59 * 0.017 + 0.3, 2);
    expect(cost.margin).toBeGreaterThan(0.9);
  });
});

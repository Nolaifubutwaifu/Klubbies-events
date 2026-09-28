import { describe, expect, it } from "vitest";
import { canWrite, isPaidStatus, statusFromSubscription } from "@/lib/billing/status";

describe("billing status", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["unpaid", "canceled"],
    ["canceled", "canceled"],
    ["incomplete_expired", "canceled"],
    ["paused", "canceled"],
    ["incomplete", "unpaid"],
  ])("maps Stripe %s to %s", (stripeStatus, expected) => {
    expect(statusFromSubscription(stripeStatus)).toBe(expected);
  });

  it("counts paid, retrying or comped as paid", () => {
    expect(["active", "past_due", "comped"].every(isPaidStatus)).toBe(true);
    expect(["unpaid", "canceled"].some(isPaidStatus)).toBe(false);
  });

  it("lets a Free event upload and take guests without paying", () => {
    expect(canWrite({ plan: "free", billing_status: "unpaid" })).toBe(true);
    expect(canWrite({ plan: "small", billing_status: "active" })).toBe(true);
    expect(canWrite({ plan: "small", billing_status: "unpaid" })).toBe(false);
    expect(canWrite({ plan: "unlimited", billing_status: "canceled" })).toBe(false);
  });
});

describe("after the 12 month deletion", () => {
  it("takes nothing new", () => {
    expect(canWrite({ plan: "free", billing_status: "unpaid", photos_deleted_at: "2027-10-11T00:00:00Z" })).toBe(false);
  });
});

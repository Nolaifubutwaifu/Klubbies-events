import { describe, expect, it } from "vitest";
import { canWrite, statusFromSubscription } from "@/lib/billing/status";

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

  it("only lets paid, retrying or comped clubs add members and upload", () => {
    expect(["active", "past_due", "comped"].every(canWrite)).toBe(true);
    expect(["unpaid", "canceled"].some(canWrite)).toBe(false);
  });
});

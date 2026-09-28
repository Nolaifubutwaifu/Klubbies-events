import { describe, expect, it } from "vitest";
import { BIN_DAYS, restorableUntil } from "@/lib/media/bin";

describe("Recently deleted", () => {
  it("keeps things for 30 days", () => {
    expect(BIN_DAYS).toBe(30);
    expect(restorableUntil("2026-09-28T02:00:00.000Z").toISOString()).toBe("2026-10-28T02:00:00.000Z");
  });

  it("counts whole days across a daylight saving change", () => {
    // Sydney moves its clocks on 4 Oct 2026; the bin counts in UTC, so it is
    // still exactly 30 × 24 hours.
    const until = restorableUntil(new Date("2026-10-01T00:00:00.000Z"));
    expect(until.getTime() - Date.parse("2026-10-01T00:00:00.000Z")).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

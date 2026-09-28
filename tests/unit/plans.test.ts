import { describe, expect, it } from "vitest";
import { includedGuests, mediaUnits, TIERS, upgradePrice, windowCeiling } from "@/lib/billing/plans";

describe("tiers", () => {
  it("match the pricing handoff", () => {
    expect(TIERS.free).toMatchObject({ guests: 50, photos: 200, price: { club: 0, standard: 0 } });
    expect(TIERS.small).toMatchObject({ guests: 150, photos: 1500, price: { club: 29, standard: 49 } });
    expect(TIERS.medium).toMatchObject({ guests: 400, photos: 4000, price: { club: 59, standard: 79 } });
    expect(TIERS.large).toMatchObject({ guests: 1000, photos: 10000, price: { club: 119, standard: 149 } });
  });

  it("include 10% over, and the window runs to 50% over", () => {
    expect(includedGuests(150)).toBe(165);
    expect(windowCeiling(150)).toBe(225);
    expect(includedGuests(50)).toBe(55);
    expect(windowCeiling(50)).toBe(75);
  });
});

describe("videos", () => {
  it("count 10 photos per started minute", () => {
    expect(mediaUnits("photo", null)).toBe(1);
    expect(mediaUnits("video", 30)).toBe(10);
    expect(mediaUnits("video", 60)).toBe(10);
    expect(mediaUnits("video", 61)).toBe(20);
    expect(mediaUnits("video", null)).toBe(10);
  });
});

describe("upgrade prices", () => {
  // The table in docs/handoff-pricing-tiers.md §5.6: [from, to, on time club, standard, late club, standard].
  it.each([
    ["free", "small", 29, 49, 36, 61],
    ["free", "medium", 59, 79, 74, 99],
    ["free", "large", 119, 149, 149, 186],
    ["small", "medium", 30, 30, 38, 38],
    ["small", "large", 90, 100, 113, 125],
    ["medium", "large", 60, 70, 75, 88],
  ] as const)("%s to %s", (from, to, club, standard, lateClub, lateStandard) => {
    expect(upgradePrice(from, to, "club", false)).toBe(club);
    expect(upgradePrice(from, to, "standard", false)).toBe(standard);
    expect(upgradePrice(from, to, "club", true)).toBe(lateClub);
    expect(upgradePrice(from, to, "standard", true)).toBe(lateStandard);
  });

  it("is never a downgrade", () => {
    expect(upgradePrice("medium", "small", "club", false)).toBeNull();
    expect(upgradePrice("small", "small", "club", false)).toBeNull();
  });
});

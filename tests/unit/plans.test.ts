import { describe, expect, it } from "vitest";
import { normaliseClubCode } from "@/lib/billing/club-codes";
import { includedGuests, mediaUnits, retentionNotice, suggestedTier, TIERS, tierOffers, upgradePrice, windowCeiling } from "@/lib/billing/plans";

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
    expect(mediaUnits("video", 4)).toBe(1);
    expect(mediaUnits("video", 6)).toBe(1);
    expect(mediaUnits("video", 6.5)).toBe(2);
    expect(mediaUnits("video", 30)).toBe(5);
    expect(mediaUnits("video", 60)).toBe(10);
    expect(mediaUnits("video", 120)).toBe(20);
    expect(mediaUnits("video", null)).toBe(10);
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

describe("what an event can buy", () => {
  const base = { plan: "free", plan_rate: null, club_code: null, overflow_started_at: null };

  it("offers every paid size from Free, at standard prices without a club code", () => {
    const offers = tierOffers(base);
    expect(offers.map((o) => [o.to, o.amount, o.kind])).toEqual([
      ["small", 49, "tier"],
      ["medium", 79, "tier"],
      ["large", 149, "tier"],
    ]);
  });

  it("uses club prices with a club code, until the first payment fixes the rate", () => {
    expect(tierOffers({ ...base, club_code: "UQCLUBS" })[0].amount).toBe(29);
    expect(tierOffers({ ...base, plan: "small", plan_rate: "standard", club_code: "UQCLUBS" })[0]).toMatchObject({
      to: "medium",
      amount: 30,
      rate: "standard",
      kind: "upgrade",
    });
  });

  it("charges the late price once the window has opened", () => {
    expect(tierOffers({ ...base, plan: "small", plan_rate: "club", overflow_started_at: "2026-10-01T00:00:00Z" })[0]).toMatchObject({
      to: "medium",
      amount: 38,
      late: true,
    });
  });

  it("gives founding clubs their A$60 Medium to Large gap", () => {
    expect(tierOffers({ ...base, plan: "medium", plan_rate: "club" })[0]).toMatchObject({ to: "large", amount: 60 });
  });

  it("offers nothing to unlimited or custom events", () => {
    expect(tierOffers({ ...base, plan: "unlimited" })).toEqual([]);
    expect(tierOffers({ ...base, plan: "custom" })).toEqual([]);
  });

  it("suggests the smallest size that fits", () => {
    expect(suggestedTier(40)).toBe("free");
    expect(suggestedTier(151)).toBe("medium");
    expect(suggestedTier(5000)).toBeNull();
  });
});

describe("club codes", () => {
  it("accept any case and spacing", () => {
    expect(normaliseClubCode(" uqclubs ")).toBe("UQCLUBS");
    expect(normaliseClubCode("QUT CLUBS")).toBe("QUTCLUBS");
    expect(normaliseClubCode("FOUNDING25")).toBeNull();
  });
});

describe("the deletion banner", () => {
  const now = new Date("2027-08-01T00:00:00Z");
  it("shows from 60 days before, and after", () => {
    expect(retentionNotice({ photos_delete_at: "2027-12-01T00:00:00Z", photos_deleted_at: null }, now)).toBeNull();
    expect(retentionNotice({ photos_delete_at: "2027-09-15T00:00:00Z", photos_deleted_at: null }, now)).toMatchObject({ kind: "soon" });
    expect(retentionNotice({ photos_delete_at: "2027-07-01T00:00:00Z", photos_deleted_at: "2027-07-01T01:00:00Z" }, now)).toMatchObject({ kind: "deleted" });
  });
});

/**
 * The tiers (docs/handoff-pricing-tiers.md). The one place these numbers live:
 * the database is told the limits when an event moves plan
 * (public.apply_event_plan), and pricing copy reads them from here.
 *
 * Safe for the browser: no secrets, no server imports.
 */

export type Tier = "free" | "small" | "medium" | "large";
export type Plan = Tier | "custom" | "unlimited";
export type Rate = "club" | "standard";

export type TierSpec = {
  name: string;
  guests: number;
  photos: number;
  /** A$, one payment per event. */
  price: Record<Rate, number>;
};

export const TIERS: Record<Tier, TierSpec> = {
  free: { name: "Free", guests: 50, photos: 200, price: { club: 0, standard: 0 } },
  small: { name: "Small", guests: 150, photos: 1500, price: { club: 29, standard: 49 } },
  medium: { name: "Medium", guests: 400, photos: 4000, price: { club: 59, standard: 79 } },
  large: { name: "Large", guests: 1000, photos: 10000, price: { club: 119, standard: 149 } },
};

export const TIER_ORDER: Tier[] = ["free", "small", "medium", "large"];

/** Guests past the limit who still join normally: 10%. */
export const INCLUDED_OVER = 0.1;
/** How far past the limit the overflow window lets guests keep joining: 50%. */
export const WINDOW_OVER = 0.5;
export const WINDOW_HOURS = 48;
/** Upgrading after the window has opened costs the difference plus 25%. */
export const LATE_SURCHARGE = 0.25;

/** Each started minute of video counts as this many photos (1 per started 6 seconds). */
export const VIDEO_UNITS_PER_MINUTE = 10;
export const VIDEO_SECONDS_PER_UNIT = 60 / VIDEO_UNITS_PER_MINUTE;
/** The largest video anyone can upload, in bytes. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export function isTier(value: string | null | undefined): value is Tier {
  return value === "free" || value === "small" || value === "medium" || value === "large";
}

export function planName(plan: string): string {
  if (isTier(plan)) return TIERS[plan].name;
  if (plan === "custom") return "Custom";
  return "Unlimited";
}

/** Guests who join normally: the limit plus 10%. 150 → 165. */
export function includedGuests(limit: number): number {
  return Math.floor(limit * (1 + INCLUDED_OVER));
}

/** The most guests the overflow window lets in: the limit plus 50%. 150 → 225. */
export function windowCeiling(limit: number): number {
  return Math.floor(limit * (1 + WINDOW_OVER));
}

/** Photos a file uses up: 1 for a photo, 1 per started 6 seconds of video (migration 34). */
export function mediaUnits(kind: string, durationSeconds: number | null | undefined): number {
  if (kind !== "video") return 1;
  return Math.max(1, Math.ceil((durationSeconds ?? 60) / VIDEO_SECONDS_PER_UNIT));
}

/**
 * What moving from one tier to a bigger one costs, in whole A$. On time it is
 * the difference; late (the overflow window has opened) the difference plus
 * 25%, rounded to the nearest dollar. Null when it isn't an upgrade.
 */
export function upgradePrice(from: Tier, to: Tier, rate: Rate, late: boolean): number | null {
  if (TIER_ORDER.indexOf(to) <= TIER_ORDER.indexOf(from)) return null;
  const difference = TIERS[to].price[rate] - TIERS[from].price[rate];
  return late ? Math.round(difference * (1 + LATE_SURCHARGE)) : difference;
}

/** The limits the database enforces for a tier. */
export function tierLimits(tier: Tier): { guestLimit: number; photoLimit: number } {
  return { guestLimit: TIERS[tier].guests, photoLimit: TIERS[tier].photos };
}

export type TierOffer = {
  from: Plan;
  to: Tier;
  rate: Rate;
  /** The overflow window has opened on the current tier: the difference plus 25%. */
  late: boolean;
  /** A$ to pay. */
  amount: number;
  /** Moving off Free is a first purchase; from a paid tier it is an upgrade. */
  kind: "tier" | "upgrade";
};

/**
 * What the event can move to and what each costs. Free can buy any paid tier;
 * a paid tier can move up. Unlimited and custom events have nothing to buy.
 * The rate is the one the event paid with, else club when it has a club code.
 */
export function tierOffers(event: {
  plan: string;
  plan_rate: string | null;
  club_code: string | null;
  overflow_started_at: string | null;
  photos_deleted_at?: string | null;
}): TierOffer[] {
  if (!isTier(event.plan)) return [];
  // After the 12 month deletion nothing new can go in, so a bigger size
  // would be paid for and unlock nothing.
  if (event.photos_deleted_at) return [];
  const from = event.plan;
  const rate: Rate = event.plan_rate === "club" || event.plan_rate === "standard" ? event.plan_rate : event.club_code ? "club" : "standard";
  const late = Boolean(event.overflow_started_at);
  return TIER_ORDER.filter((to) => TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from)).map((to) => ({
    from,
    to,
    rate,
    late,
    amount: upgradePrice(from, to, rate, late) ?? 0,
    kind: from === "free" ? "tier" : "upgrade",
  }));
}

/** The smallest tier that fits an expected headcount. */
export function suggestedTier(expectedGuests: number | null | undefined): Tier | null {
  if (!expectedGuests) return null;
  return TIER_ORDER.find((tier) => TIERS[tier].guests >= expectedGuests) ?? null;
}

/** When the event's overflow window closes, and whether it is open now. */
export function overflowWindow(
  event: { overflow_started_at: string | null; overflow_closed_at: string | null },
  now = new Date(),
): { windowEnds: Date | null; windowOpen: boolean } {
  if (!event.overflow_started_at) return { windowEnds: null, windowOpen: false };
  const windowEnds = new Date(new Date(event.overflow_started_at).getTime() + WINDOW_HOURS * 3600 * 1000);
  return { windowEnds, windowOpen: !event.overflow_closed_at && windowEnds > now };
}

/** "Keep another year": A$ per event per year (retention handoff, phase 3). */
export const KEEP_YEAR_AUD = 29;

/**
 * The organiser banner about the 12 month deletion: from 60 days before it,
 * and a plain statement after. Null when there is nothing to say yet.
 */
export function retentionNotice(
  event: { photos_delete_at: string | null; photos_deleted_at: string | null },
  now = new Date(),
): { kind: "soon"; on: string } | { kind: "deleted"; on: string } | null {
  if (event.photos_deleted_at) return { kind: "deleted", on: event.photos_deleted_at };
  if (!event.photos_delete_at) return null;
  const msLeft = new Date(event.photos_delete_at).getTime() - now.getTime();
  return msLeft <= 60 * 24 * 3600 * 1000 ? { kind: "soon", on: event.photos_delete_at } : null;
}

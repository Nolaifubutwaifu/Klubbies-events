/**
 * Campus club codes (pricing handoff §3). Entered on the billing page, a code
 * switches an event to club prices until its first payment, which fixes the
 * rate. They are app codes, not Stripe promotion codes, because one Stripe
 * code can't give a different discount per tier. Each one also records which
 * campus the club came from. Check a club is real (its union listing) before
 * handing a code out; add a campus here.
 */
export const CLUB_CODES: Record<string, string> = {
  UQCLUBS: "University of Queensland",
  QUTCLUBS: "QUT",
  GRIFFITHCLUBS: "Griffith University",
};

/** The canonical code, or null if it isn't one. Case and spaces don't matter. */
export function normaliseClubCode(input: string): string | null {
  const code = input.replace(/\s+/g, "").toUpperCase();
  return code in CLUB_CODES ? code : null;
}

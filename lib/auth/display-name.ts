import "server-only";
import type { ClubContext } from "./session";
import { getProfile } from "./session";

type NameParts = {
  displayName?: string | null;
  claimedName?: string | null;
  rosterName?: string | null;
  email?: string | null;
};

/**
 * What to call a person, the same rule on every screen. The name they set on
 * their profile wins, because the profile page promises "this is what others
 * see". Then the name they signed in under, then the one on the club's list.
 * Screens used to disagree, so one person showed as "max" in one club's rail
 * and "Maxi" in the next.
 */
export function personName({ displayName, claimedName, rosterName, email }: NameParts): string {
  for (const name of [displayName, claimedName, rosterName, email]) {
    if (name?.trim()) return name.trim();
  }
  return "";
}

export async function displayNameFor(ctx: ClubContext): Promise<string> {
  const profile = await getProfile();
  return personName({
    displayName: profile?.display_name,
    claimedName: ctx.membership?.claimed_name,
    rosterName: ctx.membership?.roster_name,
    email: profile?.email,
  });
}

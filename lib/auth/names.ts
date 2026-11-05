function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’-]/g, "")
    .replace(/\./g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function firstChar(token: string): string {
  return [...token][0] ?? "";
}

/** A written initial ("A", or "J." once the dot is its own word), not a given name. */
function isInitial(token: string): boolean {
  return [...token].length === 1;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Loose comparison between the roster name and the name typed at sign-in.
 * A mismatch holds a guest-list sign-in until an organiser approves it
 * (migration 36). Case, accents, dots ("alice.smith") and a first initial
 * ("A Smith") still match.
 * One token of a longer name does not, and neither does a different given
 * name that merely shares an initial ("Aaron Smith").
 */
export function namesLooselyMatch(rosterName: string, claimedName: string): boolean {
  const a = tokens(rosterName);
  const b = tokens(claimedName);
  if (a.length === 0 || b.length === 0) return false;

  const joinedA = a.join(" ");
  const joinedB = b.join(" ");
  if (joinedA === joinedB) return true;
  // "Smith" or "Ali" must not pass for "Alice Smith", and a single given name
  // must not pass for a full roster name.
  if (a.length === 1 || b.length === 1) return false;

  const [firstA, lastA] = [a[0], a[a.length - 1]];
  const [firstB, lastB] = [b[0], b[b.length - 1]];
  if (firstA === lastB && lastA === firstB && a.length === 2 && b.length === 2) return true;
  if (lastA === lastB && (isInitial(firstA) || isInitial(firstB)) && firstChar(firstA) === firstChar(firstB)) return true;
  // A short form of the first name ("Alex" for "Alexander") with the same surname.
  const shortForm = (x: string, y: string) => x.length >= 3 && y.startsWith(x);
  if (lastA === lastB && (shortForm(firstA, firstB) || shortForm(firstB, firstA))) return true;

  return levenshtein(joinedA, joinedB) <= Math.max(1, Math.floor(joinedA.length / 10));
}

/**
 * Link-mode joins have no organiser-supplied roster name, so the name check
 * does not apply to the row just created for that event.
 */
export function holdsForNameMismatch(linkedByJoin: boolean, rosterName: string | null, claimedName: string): boolean {
  if (linkedByJoin) return false;
  if (!claimedName) return false;
  return !namesLooselyMatch(rosterName ?? "", claimedName);
}

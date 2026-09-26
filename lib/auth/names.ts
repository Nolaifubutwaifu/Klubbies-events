function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.-]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
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
 * A mismatch never blocks access; it only raises a flag for the admin.
 */
export function namesLooselyMatch(rosterName: string, claimedName: string): boolean {
  const a = tokens(rosterName);
  const b = tokens(claimedName);
  if (a.length === 0 || b.length === 0) return false;

  const joinedA = a.join(" ");
  const joinedB = b.join(" ");
  if (joinedA === joinedB) return true;

  const setA = new Set(a);
  const setB = new Set(b);
  if (b.every((t) => setA.has(t)) || a.every((t) => setB.has(t))) return true;

  const [firstA, lastA] = [a[0], a[a.length - 1]];
  const [firstB, lastB] = [b[0], b[b.length - 1]];
  if (lastA === lastB && firstA[0] === firstB[0]) return true;
  if (firstA === lastB && lastA === firstB) return true;

  return levenshtein(joinedA, joinedB) <= Math.max(1, Math.floor(joinedA.length / 10));
}

/**
 * A photo keeps its own shape in the grid (width / height). Extremes are
 * reined in so one panorama can't take a whole row to itself on a phone, and
 * a file with no recorded size sits square.
 */
export function tileRatio(width: number | null | undefined, height: number | null | undefined): number {
  if (!width || !height) return 1;
  return Math.min(2.2, Math.max(0.6, width / height));
}

import { ZIP_PART_SIZE } from "@/lib/media/zip-parts";

/**
 * Every part of a download, not just the first. A part holds ZIP_PART_SIZE
 * files or about 500 MB, whichever is smaller. Pass `partCounts` (files in
 * each part, in order) when the split depends on size; otherwise the links
 * assume equal chunks of ZIP_PART_SIZE.
 */
export function ZipParts({
  href,
  count,
  partCounts,
  label = "Download all",
  className = "btn btn-secondary no-underline",
}: {
  href: string;
  count: number;
  partCounts?: number[];
  label?: string;
  className?: string;
}) {
  const counts = partCounts && partCounts.length > 0 ? partCounts : chunksOf(count, ZIP_PART_SIZE);
  const parts = Math.max(1, counts.length);
  if (parts === 1) {
    return (
      <a href={href} className={className} download>
        {label}
      </a>
    );
  }
  const join = href.includes("?") ? "&" : "?";
  const ranges = counts.map((n, i) => {
    const from = 1 + counts.slice(0, i).reduce((sum, count) => sum + count, 0);
    return { from, to: from + n - 1 };
  });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {ranges.map(({ from, to }, i) => (
        <a key={i} href={i === 0 ? href : `${href}${join}part=${i}`} className={className} download aria-label={`Part ${i + 1} of ${parts}, files ${from} to ${to}`}>
          Part {i + 1} of {parts}
        </a>
      ))}
    </span>
  );
}

function chunksOf(count: number, size: number): number[] {
  if (count <= 0) return [0];
  const chunks: number[] = [];
  let left = count;
  while (left > 0) {
    const n = Math.min(size, left);
    chunks.push(n);
    left -= n;
  }
  return chunks;
}

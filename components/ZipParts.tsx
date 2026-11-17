import { formatBytes } from "@/lib/format";
import { ZIP_PART_SIZE, type ZipPartSummary } from "@/lib/media/zip-parts";

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
  partSummaries,
  label = "Download all",
  className = "btn btn-secondary no-underline",
}: {
  href: string;
  count: number;
  /** @deprecated Prefer partSummaries, which includes the byte total. */
  partCounts?: number[];
  partSummaries?: ZipPartSummary[];
  label?: string;
  className?: string;
}) {
  const summaries: ZipPartSummary[] =
    partSummaries && partSummaries.length > 0
      ? partSummaries
      : (partCounts && partCounts.length > 0 ? partCounts : chunksOf(count, ZIP_PART_SIZE)).map((files) => ({ files, bytes: 0 }));
  const parts = Math.max(1, summaries.length);
  if (parts === 1) {
    return (
      <a href={href} className={className} download>
        {label}
      </a>
    );
  }
  const join = href.includes("?") ? "&" : "?";
  return (
    <span className="flex flex-wrap items-center gap-2">
      {summaries.map((summary, i) => {
        const text = summary.bytes > 0 ? `Part ${i + 1} of ${parts}, ${formatBytes(summary.bytes)}` : `Part ${i + 1} of ${parts}`;
        return (
          <a key={i} href={i === 0 ? href : `${href}${join}part=${i}`} className={className} download aria-label={text}>
            {text}
          </a>
        );
      })}
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

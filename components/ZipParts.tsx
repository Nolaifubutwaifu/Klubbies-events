import { ZIP_PART_SIZE } from "@/lib/media/zip-parts";

/**
 * Every part of a download, not just the first. A zip holds ZIP_PART_SIZE
 * files, so a bigger set is offered as numbered parts with their ranges.
 */
export function ZipParts({
  href,
  count,
  label = "Download all",
  className = "btn btn-secondary no-underline",
}: {
  href: string;
  count: number;
  label?: string;
  className?: string;
}) {
  const parts = Math.max(1, Math.ceil(count / ZIP_PART_SIZE));
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
      {Array.from({ length: parts }, (_, i) => {
        const from = i * ZIP_PART_SIZE + 1;
        const to = Math.min(count, (i + 1) * ZIP_PART_SIZE);
        return (
          <a key={i} href={i === 0 ? href : `${href}${join}part=${i}`} className={className} download>
            Part {i + 1} ({from}–{to})
          </a>
        );
      })}
    </span>
  );
}

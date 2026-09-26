import { plural } from "@/lib/format";

/**
 * What's still landing. Members can't read an unfinished media row — RLS only
 * admits `status = 'ready'` — so the count comes from the server and the tiles
 * stand in for files that have no preview yet. It beats the alternative, which
 * is a member who was at the event wondering where the videos went.
 */
export function ProcessingBanner({ photos, videos }: { photos: number; videos: number }) {
  const total = photos + videos;
  if (total === 0) return null;

  const what = videos > 0 && photos > 0 ? plural(total, "file") : videos > 0 ? plural(videos, "video") : plural(photos, "photo");

  return (
    <div className="w-full px-4 pt-3 sm:px-6">
      <div className="flex items-center gap-3 rounded-[18px] bg-[color:var(--tone-support)] px-3.5 py-3 text-[color:var(--tone-support-ink)]">
        <span
          className="h-[34px] w-[34px] flex-none rounded-full border-[3px] motion-safe:animate-spin"
          style={{
            borderColor: "color-mix(in srgb, var(--tone-support-ink) 25%, transparent)",
            borderTopColor: "var(--tone-support-ink)",
            animationDuration: "1.1s",
          }}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block text-[14px] font-bold">{what} still cooking</span>
          <span className="block text-[14px]">Usually 2&ndash;5 minutes. You can leave the page.</span>
        </span>
      </div>
    </div>
  );
}

/** The tiles those files will become, so the grid doesn't jump when they land. */
export function ProcessingTiles({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <>
      {Array.from({ length: Math.min(count, 12) }, (_, i) => (
        <span
          key={`processing-${i}`}
          className="relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[10px]"
          style={{ background: "color-mix(in srgb, var(--color-text) 7%, transparent)" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-neutral-700)"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="motion-safe:animate-spin"
            style={{ animationDuration: "1.1s" }}
            aria-hidden
          >
            <path d="M12 4a8 8 0 1 1-5.7 2.4" />
          </svg>
          <span className="text-[14px] font-bold text-[color:var(--color-neutral-700)]">Processing</span>
        </span>
      ))}
    </>
  );
}

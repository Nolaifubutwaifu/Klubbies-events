"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import Link from "next/link";
import { useState } from "react";
import type { SavedGroup } from "@/lib/media/favourites";
import { formatDate } from "@/lib/format";

export type DownloadedItem = {
  id: string;
  albumId: string | null;
  albumTitle: string;
  thumbUrl: string | null;
  at: string;
};

function duration(seconds: number | null): string {
  if (!seconds) return "";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Heart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />
    </svg>
  );
}

/**
 * Two lists, one screen: what you kept and what you've already taken away.
 * Grouped by album, because that is how anyone remembers a photo.
 */
export function SavedTabs({
  handle,
  groups,
  downloads,
}: {
  handle: string;
  groups: SavedGroup[];
  downloads: DownloadedItem[];
}) {
  const [tab, setTab] = useState<"favourites" | "downloads">("favourites");
  const favouriteCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  const downloadGroups = downloads.reduce<Map<string, DownloadedItem[]>>((map, item) => {
    const key = item.albumId ?? "none";
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map());

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["favourites", `Favourites ${favouriteCount.toLocaleString("en-AU")}`],
            ["downloads", `Downloads ${downloads.length.toLocaleString("en-AU")}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`soft-btn !min-h-[40px] !px-4 !text-[14px] ${tab === value ? "!bg-ink !text-white" : "soft-btn-tonal"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "favourites" ? (
        <div className="mt-6 flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.albumId}>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/c/${handle}/a/${group.albumId}`} className="soft-display text-[18px] text-ink no-underline">
                  {group.albumTitle}
                </Link>
                {group.albumDate ? <span className="text-[14px] text-[color:var(--ink-55)]">{formatDate(group.albumDate)}</span> : null}
                <span className="text-[14px] text-[color:var(--ink-55)]">{group.items.length} saved</span>
                <a
                  href={`/api/albums/${group.albumId}/zip?only=${group.items.map((i) => i.id).join(",")}`}
                  className="kb-link ml-auto"
                >
                  Download these
                </a>
              </div>
              <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(104px, 13vw, 150px), 1fr))" }}>
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/c/${handle}/a/${group.albumId}/${item.id}`}
                    aria-label={`${item.kind === "video" ? "Video" : "Photo"} from ${group.albumTitle}`}
                    className="soft-tile relative block aspect-square !rounded-[11px]"
                    scroll={false}
                  >
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    {item.kind === "video" ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(25,18,22,0.72)] px-2 py-0.5 text-[14px] font-bold text-white">
                        {duration(item.durationSeconds) || "Video"}
                      </span>
                    ) : null}
                    <span className="absolute bottom-1.5 right-1.5 text-white drop-shadow" aria-hidden>
                      <Heart />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : downloads.length ? (
        <div className="mt-6 flex flex-col gap-8">
          {[...downloadGroups.entries()].map(([key, items]) => (
            <section key={key}>
              <div className="flex flex-wrap items-center gap-3">
                {items[0].albumId ? (
                  <Link href={`/c/${handle}/a/${items[0].albumId}`} className="soft-display text-[18px] text-ink no-underline">
                    {items[0].albumTitle}
                  </Link>
                ) : (
                  <span className="soft-display text-[18px]">{items[0].albumTitle}</span>
                )}
                <span className="text-[14px] text-[color:var(--ink-55)]">
                  {items.length} download{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(104px, 13vw, 150px), 1fr))" }}>
                {items.map((item) => (
                  <Link
                    key={`${item.id}-${item.at}`}
                    href={item.albumId ? `/c/${handle}/a/${item.albumId}/${item.id}` : `/c/${handle}`}
                    aria-label={`Downloaded from ${item.albumTitle}, ${formatDate(item.at)}`}
                    className="soft-tile relative block aspect-square !rounded-[11px]"
                    scroll={false}
                  >
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 max-w-[46ch] text-[15px] text-[color:var(--ink-70)]">
          Nothing downloaded yet. Anything you save to your phone or pull down as a zip shows up here, so you can find
          it again.
        </p>
      )}
    </>
  );
}

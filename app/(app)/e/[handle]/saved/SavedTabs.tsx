"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/Segmented";
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
  const favouriteCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  // Open on whichever list has something in it.
  const [tab, setTab] = useState<"favourites" | "downloads">(favouriteCount === 0 && downloads.length ? "downloads" : "favourites");

  const downloadGroups = downloads.reduce<Map<string, DownloadedItem[]>>((map, item) => {
    const key = item.albumId ?? "none";
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map());

  const tile = "soft-tile relative block aspect-square !rounded-[3px]";
  const grid = "grid grid-cols-3 gap-[3px] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-1";
  const only = groups.length === 1 ? groups[0] : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="serif text-[44px] leading-none">Saved</h1>
        {tab === "favourites" && only ? (
          <a href={`/api/albums/${only.albumId}/zip?only=${only.items.map((i) => i.id).join(",")}`} className="btn btn-secondary no-underline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
            </svg>
            Download {favouriteCount.toLocaleString("en-AU")}
          </a>
        ) : null}
      </div>

      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        className="sm:max-w-[420px]"
        options={[
          { value: "favourites", label: "Favourites", count: favouriteCount },
          { value: "downloads", label: "Downloaded", count: downloads.length },
        ]}
      />

      {tab === "favourites" && favouriteCount === 0 ? (
        <p className="text-center text-[14px] text-[color:var(--kb-ink-3)]">Tap the heart on any photo to keep it here.</p>
      ) : tab === "favourites" ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.albumId} className="flex flex-col gap-2.5">
              {groups.length > 1 ? (
                <div className="flex flex-wrap items-baseline gap-3">
                  <Link href={`/e/${handle}/a/${group.albumId}`} className="text-[18px] font-semibold text-ink no-underline">
                    {group.albumTitle}
                  </Link>
                  <span className="mono text-[14px] text-[color:var(--kb-ink-3)]">{group.items.length}</span>
                  <a href={`/api/albums/${group.albumId}/zip?only=${group.items.map((i) => i.id).join(",")}`} className="ml-auto text-[15px] font-medium">
                    Download these
                  </a>
                </div>
              ) : null}
              <div className={grid}>
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/e/${handle}/a/${group.albumId}/${item.id}`}
                    aria-label={`${item.kind === "video" ? "Video" : "Photo"} from ${group.albumTitle}`}
                    className={tile}
                    scroll={false}
                  >
                    {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                    {item.kind === "video" ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[rgb(11_12_15/0.72)] px-2 py-0.5 text-[14px] font-semibold text-white">
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
          <p className="text-center text-[14px] text-[color:var(--kb-ink-3)]">Tap the heart on any photo to keep it here.</p>
        </div>
      ) : downloads.length ? (
        <div className="flex flex-col gap-6">
          {[...downloadGroups.entries()].map(([key, items]) => (
            <section key={key} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline gap-3">
                {items[0].albumId ? (
                  <Link href={`/e/${handle}/a/${items[0].albumId}`} className="text-[18px] font-semibold text-ink no-underline">
                    {items[0].albumTitle}
                  </Link>
                ) : (
                  <span className="text-[18px] font-semibold">{items[0].albumTitle}</span>
                )}
                <span className="mono text-[14px] text-[color:var(--kb-ink-3)]">{items.length}</span>
              </div>
              <div className={grid}>
                {items.map((item) => (
                  <Link
                    key={`${item.id}-${item.at}`}
                    href={item.albumId ? `/e/${handle}/a/${item.albumId}/${item.id}` : `/e/${handle}`}
                    aria-label={`Downloaded from ${item.albumTitle}, ${formatDate(item.at)}`}
                    className={tile}
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
        <p className="max-w-[46ch] text-[15px] text-[color:var(--ink-70)]">
          Nothing downloaded yet. Anything you save to your phone or pull down as a zip shows up here, so you can find it
          again.
        </p>
      )}
    </div>
  );
}

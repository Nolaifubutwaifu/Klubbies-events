"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarIcon, CameraIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, PlusIcon, SearchIcon, XIcon } from "@/components/soft/icons";
import { ConfettiArt, PhotoStackArt } from "@/components/soft/illustrations";
import { EmptyClub } from "@/components/soft/EmptyClub";
import { formatDate, formatLongDate, plural } from "@/lib/format";
import { findAnniversary } from "@/lib/media/anniversary";
import { eventTypeLabel } from "@/lib/media/event-types";
import type { StackedAlbum } from "@/lib/media/album-list";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function dayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+10:00` : value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function countLabel(album: StackedAlbum): string {
  const parts = [
    album.photoCount ? `${album.photoCount.toLocaleString("en-AU")} photo${album.photoCount === 1 ? "" : "s"}` : null,
    album.videoCount ? `${album.videoCount.toLocaleString("en-AU")} video${album.videoCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Nothing in here yet";
}

const brisbaneHour = new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: "Australia/Brisbane" });

/**
 * In the zone every other date in the app uses, so the server render and the
 * browser agree on which half of the day it is.
 */
function greeting(): string {
  const hour = Number(brisbaneHour.format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function SoftEvents({
  albums,
  hrefBase,
  canManage,
  clubName,
  newAlbumHref,
  firstName,
  notifiesOnNewAlbums = false,
  photosOfYou,
}: {
  albums: StackedAlbum[];
  hrefBase: string;
  canManage: boolean;
  clubName: string;
  newAlbumHref: string;
  /** Used for the greeting; empty falls back to the club name. */
  firstName?: string;
  /** Whether this member already gets the new-album email. */
  notifiesOnNewAlbums?: boolean;
  /** Confirmed face matches per album id. Empty when the member has not enrolled. */
  photosOfYou?: Map<string, number>;
}) {
  const [query, setQuery] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(albums[0] ? new Date(albums[0].date) : new Date()));

  const daysWithPhotos = useMemo(() => new Set(albums.map((a) => dayKey(a.date))), [albums]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return albums.filter((album) => {
      const matchesText = !q || album.title.toLowerCase().includes(q) || (album.description ?? "").toLowerCase().includes(q);
      const matchesDay = !day || dayKey(album.date) === day;
      return matchesText && matchesDay;
    });
  }, [albums, query, day]);

  const filtersOn = query.trim() !== "" || day !== null;
  /* Lead with the newest album that has something to show, not just the newest
     one — an empty draft shouldn't cost the page its hero. */
  const hero = filtersOn ? null : (filtered.find((a) => a.coverUrl && a.photoCount + a.videoCount > 0) ?? null);
  const rows = hero ? filtered.filter((a) => a.id !== hero.id) : filtered;
  // One rule for every count in the app: published albums, finished files.
  // Drafts are real but only the committee sees them, so they get their own
  // label rather than quietly inflating the number members also see.
  const published = albums.filter((a) => a.status === "published");
  const drafts = albums.length - published.length;
  const totals = published.reduce((sum, a) => sum + a.photoCount + a.videoCount, 0);
  const newCount = albums.filter((a) => a.isNew).length;
  const memory = filtersOn ? null : findAnniversary(albums);

  return (
    <div className="w-full px-4 pb-16 pt-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[260px]">
          {/* The club is the identity; the greeting is a nicety. A member in
              four clubs needs to know which one this is at a glance. */}
          {firstName ? (
            <p className="mb-1 text-[14px] font-semibold text-ink-55" suppressHydrationWarning>
              {greeting()}, {firstName}
            </p>
          ) : null}
          <h1 className="text-[clamp(30px,4.5vw,44px)]">{clubName}</h1>
          <p className="mt-2 text-[15px] text-ink-55">
            {newCount
              ? `${plural(newCount, "album")} landed since you were last here.`
              : published.length
                ? `${plural(published.length, "album")} · ${plural(totals, "photo or video", "photos and videos")}`
                : "Everything the committee shares lands here."}
            {canManage && drafts > 0 ? ` · ${plural(drafts, "draft")} only the committee can see` : ""}
          </p>
        </div>
        {/* Search and New album share one row on a wide screen; the button
            used to hang underneath the field on a line of its own. */}
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          {albums.length === 0 ? null : (
          <div className="relative sm:w-[320px]">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-55">
              <SearchIcon />
            </span>
            <input
              className="soft-input pl-11 pr-[112px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an event"
              aria-label="Search event names"
              type="search"
            />
            {/* The date filter rides inside the field rather than taking a row
                of its own — on a phone that row cost ~70px of the fold. */}
            <button
              type="button"
              onClick={() => setCalOpen((v) => !v)}
              aria-expanded={calOpen}
              className="soft-btn soft-btn-tonal absolute right-1.5 top-1/2 !min-h-[34px] -translate-y-1/2 !px-3 !text-[14px]"
            >
              <CalendarIcon />
              <span className="max-w-[86px] truncate">{day ? formatLongDate(day) : "Any date"}</span>
            </button>
          </div>
          )}
          {canManage ? (
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <Link href={newAlbumHref} className="soft-btn soft-btn-primary no-underline">
                <PlusIcon />
                New album
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {albums.length === 0 || !filtersOn ? null : (
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
        {filtersOn ? (
          <button
            type="button"
            className="soft-btn soft-btn-tonal"
            onClick={() => {
              setQuery("");
              setDay(null);
            }}
          >
            <XIcon />
            Clear
          </button>
        ) : null}
      </div>
      )}

      {filtersOn ? (
        <p className="mt-3 text-[14px] text-ink-70">
          {filtered.length} of {albums.length} albums
        </p>
      ) : null}

      {calOpen ? (
        <div className="soft-card mt-4 flex flex-wrap gap-8 p-6">
          <div className="w-[300px] max-w-full">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="soft-btn soft-btn-tonal h-11 w-11 !min-h-0 !p-0"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeftIcon />
              </button>
              <span className="soft-display text-[17px]">{month.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</span>
              <button
                type="button"
                className="soft-btn soft-btn-tonal h-11 w-11 !min-h-0 !p-0"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRightIcon />
              </button>
            </div>
            <div className="grid grid-cols-7">
              {WEEKDAYS.map((w, i) => (
                <span key={`${w}${i}`} className="p-1 text-center text-[14px] font-bold uppercase tracking-[0.08em] text-ink-55">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid(month).map((d) => {
                const key = dayKey(d);
                const inMonth = d.getMonth() === month.getMonth();
                const has = daysWithPhotos.has(key);
                const selected = day === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDay(selected ? null : key)}
                    className="flex aspect-square flex-col items-center justify-center gap-[3px] rounded-full border-0 text-[14px] font-semibold"
                    style={{
                      background: selected
                        ? "var(--color-accent)"
                        : has
                          ? "color-mix(in srgb, var(--color-accent) 14%, transparent)"
                          : "transparent",
                      color: selected ? "#fff" : inMonth ? "var(--color-text)" : "var(--color-neutral-400)",
                      cursor: "pointer",
                    }}
                  >
                    {d.getDate()}
                    <span
                      className="h-[4px] w-[4px] rounded-full"
                      style={{ background: has ? (selected ? "#fff" : "var(--color-accent)") : "transparent" }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-3">
            <span className="soft-display text-[15px]">Jump to an event</span>
            <div className="flex flex-wrap gap-2">
              {albums.slice(0, 5).map((album) => (
                <button
                  key={album.id}
                  type="button"
                  className="soft-chip soft-chip-muted cursor-pointer"
                  onClick={() => {
                    setDay(dayKey(album.date));
                    setMonth(startOfMonth(new Date(album.date)));
                  }}
                >
                  {formatDate(album.date)}
                </button>
              ))}
            </div>
            <p className="m-0 max-w-[36ch] text-[14px] text-ink-70">Tinted days have photos. Tap a day to filter, tap again to clear.</p>
          </div>
        </div>
      ) : null}

      {memory ? (
        <Link
          href={`${hrefBase}/${memory.album.id}`}
          className="mt-6 flex items-center gap-4 rounded-[var(--soft-r)] bg-[color:var(--tone-support)] p-4 text-[color:var(--tone-support-ink)] no-underline transition-transform hover:-translate-y-0.5"
        >
          {memory.album.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={memory.album.coverUrl} alt="" className="h-[62px] w-[62px] flex-none rounded-[16px] object-cover" />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">
              {memory.years === 1 ? "One year ago tonight" : `${memory.years} years ago tonight`}
            </span>
            <span className="soft-display block truncate text-[17px] text-ink">{memory.album.title}</span>
            <span className="block text-[14px]">{countLabel(memory.album)}</span>
          </span>
          <ChevronRightIcon />
        </Link>
      ) : null}

      {albums.length === 0 ? (
        <EmptyClub clubName={clubName} alreadySubscribed={notifiesOnNewAlbums} />
      ) : filtered.length === 0 ? (
        <div className="soft-card mt-6 flex flex-col items-start gap-3 p-8">
          <span className="text-accent-400">
            <ConfettiArt />
          </span>
          <span className="soft-chip">
            <CameraIcon />
            No matches
          </span>
          <h2 className="text-[26px]">Nothing matches that</h2>
          <p className="m-0 max-w-[44ch] text-[15px] text-ink-70">
            Try a different name, or clear the date filter.
          </p>
          <button
            type="button"
            className="soft-btn soft-btn-primary"
            onClick={() => {
              setQuery("");
              setDay(null);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {hero ? (
            <Link href={`${hrefBase}/${hero.id}`} className="soft-card group mt-6 block overflow-hidden !p-0 no-underline">
              <div className="relative aspect-[16/10] w-full sm:aspect-[21/9]">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img
                  src={hero.heroUrl ?? hero.coverUrl ?? ""}
                  srcSet={hero.heroUrl && hero.coverUrl ? `${hero.coverUrl} 400w, ${hero.heroUrl} 2000w` : undefined}
                  sizes="(min-width: 1024px) 1000px, 100vw"
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(25,18,22,0.82)] via-[rgba(25,18,22,0.15)] to-transparent" />
                <span className="soft-chip absolute right-4 top-4 sm:right-6 sm:top-6">
                  {hero.isNew ? "New since you were here" : "Latest album"}
                </span>
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 sm:p-7">
                  <span className="flex flex-wrap items-center gap-2">
                    {eventTypeLabel(hero.eventType) ? (
                      <span className="soft-chip bg-white/90 text-[--color-accent-700]">{eventTypeLabel(hero.eventType)}</span>
                    ) : null}
                    <span className="soft-chip bg-white/90 text-[--color-accent-700]">{formatDate(hero.date)}</span>
                  </span>
                  <span className="soft-display text-[clamp(26px,4.5vw,44px)] text-white">{hero.title}</span>
                  <span className="flex flex-wrap items-center gap-3 text-[14px] font-semibold text-white/90">
                    {hero.photoCount ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CameraIcon size={16} />
                        {hero.photoCount.toLocaleString("en-AU")} photos
                      </span>
                    ) : null}
                    {hero.videoCount ? (
                      <span className="inline-flex items-center gap-1.5">
                        <PlayIcon size={16} />
                        {hero.videoCount.toLocaleString("en-AU")} videos
                      </span>
                    ) : null}
                    {hero.openToMembers ? <span>members can add</span> : null}
                  </span>
                </div>
              </div>
            </Link>
          ) : null}

          {/* 2-up on a phone: four albums a screen instead of one and a half,
              and 4:5 is the better crop for photos shot on a phone. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {rows.map((album) => {
              const total = album.photoCount + album.videoCount;
              return (
                <Link key={album.id} href={`${hrefBase}/${album.id}`} className="soft-card block overflow-hidden !p-0 no-underline">
                  {/* One cover, badged — the way the card reads on the live
                      site, and the way the design keeps it. */}
                  <div
                    className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]"
                    style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
                  >
                    {album.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                      <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[14px] text-ink-55">
                        <span className="text-accent-400">
                          <PhotoStackArt size={92} />
                        </span>
                        Nothing uploaded yet
                      </span>
                    )}
                    {album.isNew ? (
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2.5 py-1 text-[14px] font-bold text-white">
                        New since you were here
                      </span>
                    ) : album.status === "draft" && canManage ? (
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgba(25,18,22,0.72)] px-2.5 py-1 text-[14px] font-bold text-white">
                        Draft · only you
                      </span>
                    ) : album.status === "hidden" && canManage ? (
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgba(25,18,22,0.72)] px-2.5 py-1 text-[14px] font-bold text-white">
                        Hidden
                      </span>
                    ) : null}
                    {total > 0 ? (
                      <span className="absolute bottom-2.5 right-2.5 rounded-full bg-[rgba(25,18,22,0.72)] px-2.5 py-1 text-[14px] font-bold text-white">
                        {countLabel(album)}
                      </span>
                    ) : null}
                  </div>

                  {/* Title leads — it is the only thing anyone scans for. The
                      old "Members only" line is gone: every album in a club is
                      members-only, so repeating it on all six taught nothing. */}
                  <div className="p-3 sm:p-3.5">
                    <div className="soft-display line-clamp-2 text-[16px] text-ink sm:text-[20px]">{album.title}</div>
                    {/* The detail that makes the feature feel alive. Counted
                        once for every album on screen, never per card. */}
                    {/* Text, not a link: the whole card is already one, and an
                        <a> inside an <a> is broken HTML. The album's own "You"
                        filter is where these photos are, one tap on. */}
                    {photosOfYou?.get(album.id) ? (
                      <span className="mt-1 inline-block text-[14px] font-bold text-accent-700">
                        {plural(photosOfYou.get(album.id)!, "photo")} of you
                      </span>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {eventTypeLabel(album.eventType) ? (
                        <span className="soft-chip soft-chip-muted">{eventTypeLabel(album.eventType)}</span>
                      ) : null}
                      {/* The count is already on the cover's badge. */}
                      <span className="text-[14px] text-ink-55 sm:text-[14px]">{formatDate(album.date)}</span>
                      {album.openToMembers ? (
                        <span className="text-[14px] text-ink-55 sm:text-[14px]">· members can add</span>
                      ) : null}
                    </div>
                    {album.description ? (
                      <p className="m-0 mt-1 line-clamp-2 text-[14px] text-ink-70">{album.description}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* On a phone the header row is worth more as content than as chrome, so
          the one action that isn't in the tab bar floats instead. Sits above
          the 84px tab bar and its safe-area padding. */}
      {canManage ? (
        <Link
          href={newAlbumHref}
          aria-label="New album"
          data-fab
          className="soft-btn soft-btn-primary fixed right-4 z-30 no-underline shadow-lg sm:hidden"
          style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
        >
          <PlusIcon />
          Album
        </Link>
      ) : null}
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import Link from "next/link";
import { MoreButton, MoreLink, MoreMenu } from "@/components/MoreMenu";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  scheduleAlbumAction,
  setAlbumHiddenAction,
  setAlbumOrderAction,
  setAlbumPublishedAction,
} from "@/app/(app)/admin/actions";
import { formatDate, formatDateTime, isoToBrisbaneInput } from "@/lib/format";
import type { StackedAlbum } from "@/lib/media/album-list";

/** The conventional six-dot drag grip. */
function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="5" r="1.7" />
      <circle cx="15" cy="5" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="9" cy="19" r="1.7" />
      <circle cx="15" cy="19" r="1.7" />
    </svg>
  );
}

/**
 * Album state, at a glance. "Live" is deliberately the odd one out — a green
 * pill with a lit dot, so the thing members can actually see doesn't look like
 * every other chip on the page.
 */
function StatusChip({ album }: { album: StackedAlbum }) {
  if (album.status === "published") return <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">Published</span>;
  if (album.status === "hidden") return <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Hidden</span>;
  if (album.publishAt)
    return <span className="kb-chip bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]">Publishes {formatDateTime(album.publishAt)}</span>;
  return <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Draft</span>;
}

type Filter = "all" | "published" | "scheduled" | "draft";

/**
 * The committee's control panel for one event's albums: order, state, and when
 * a draft goes live.
 *
 * Reordering is drag and drop from the grip. Native HTML5 drag isn't reachable
 * from a keyboard, so the grip is also a real button that takes arrow keys —
 * same gesture, no visible arrow buttons cluttering every row.
 *
 * A move sends the whole list, so it stays idempotent and two committee
 * members dragging at once can't interleave into a broken order.
 */
export type AlbumStats = { views: number; downloads: number; members: number };

export function AlbumManager({
  eventId,
  handle,
  albums,
  stats = {},
}: {
  eventId: string;
  handle: string;
  albums: StackedAlbum[];
  stats?: Record<string, AlbumStats>;
}) {
  const router = useRouter();
  // Only the order is held locally, so a drag feels instant. Everything else
  // reads from props: holding the albums in state meant a refresh after hiding
  // left the row showing its old status.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  const byId = new Map(albums.map((a) => [a.id, a]));
  const order = (localOrder ?? albums.map((a) => a.id))
    .map((id) => byId.get(id))
    .filter((a): a is StackedAlbum => a !== undefined);

  const save = (ids: string[]) => {
    setLocalOrder(ids);
    startTransition(async () => {
      const res = await setAlbumOrderAction(eventId, ids);
      setMessage(res.error ?? res.message ?? "");
      if (res.ok) {
        // Server props now carry the saved order, so stop overriding them.
        setLocalOrder(null);
        router.refresh();
      }
    });
  };

  /** Lifts `fromId` out and drops it where `toId` currently sits. */
  const moveTo = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = order.map((a) => a.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    save(ids);
  };

  const nudge = (id: string, delta: number) => {
    const ids = order.map((a) => a.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    save(ids);
  };

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.error ?? res.message ?? "");
      if (res.ok) {
        setScheduling(null);
        router.refresh();
      }
    });

  if (!order.length) return null;

  const kindOf = (album: StackedAlbum): Filter =>
    album.status === "published" ? "published" : album.status === "draft" && album.publishAt ? "scheduled" : "draft";
  const counts: Record<Filter, number> = { all: order.length, published: 0, scheduled: 0, draft: 0 };
  for (const album of order) counts[kindOf(album)] += 1;
  const needle = query.trim().toLowerCase();
  const shown = order.filter((album) => (filter === "all" || kindOf(album) === filter) && (!needle || album.title.toLowerCase().includes(needle)));
  // Reordering only makes sense on the whole, unfiltered list.
  const canReorder = filter === "all" && !needle;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-[1_1_260px] items-center sm:max-w-[320px]">
          <span className="sr-only">Search albums</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ink-3)" strokeWidth="2" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search albums" className="input !pl-10" />
        </label>
        {(
          [
            ["all", "All"],
            ["published", "Published"],
            ["scheduled", "Scheduled"],
            ["draft", "Drafts"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`flex min-h-[40px] items-center gap-2 rounded-[8px] border px-3.5 text-[14px] font-medium ${
              filter === value
                ? "border-[color:var(--kb-ink)] bg-[color:var(--kb-ink)] text-white"
                : "border-[color:var(--kb-line)] bg-white text-[color:var(--kb-ink-2)] hover:border-[color:var(--kb-line-strong)]"
            }`}
          >
            {label} <span className="mono">{counts[value]}</span>
          </button>
        ))}
        {message ? <span className="kb-chip ml-auto bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">{message}</span> : null}
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white">
        <table className="kb-table">
          <thead>
            <tr>
              <th scope="col" className="w-10">
                <span className="sr-only">Order</span>
              </th>
              <th scope="col">Album</th>
              <th scope="col">Photos</th>
              <th scope="col">Views</th>
              <th scope="col">Downloads</th>
              <th scope="col">Downloads allowed</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((album) => {
              const index = order.indexOf(album);
              const dragging = dragId === album.id;
              const isTarget = overId === album.id && !dragging;
              const figures = stats[album.id] ?? { views: 0, downloads: 0, members: 0 };
              return (
                <tr
                  key={album.id}
                  onDragOver={(e) => {
                    // Only claim the drop if this is one of our rows being moved.
                    if (!canReorder || !e.dataTransfer.types.includes("text/plain")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setOverId(album.id);
                  }}
                  onDragLeave={() => setOverId((current) => (current === album.id ? null : current))}
                  onDrop={(e) => {
                    e.preventDefault();
                    // The id travels on the drag itself rather than in state.
                    const moving = e.dataTransfer.getData("text/plain") || dragId;
                    if (moving) moveTo(moving, album.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={`${isTarget ? "shadow-[inset_0_2px_0_var(--kb-brand)]" : ""} ${dragging ? "opacity-45" : ""}`}
                >
                  <td className="!pr-0">
                    {canReorder ? (
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          setDragId(album.id);
                          e.dataTransfer.effectAllowed = "move";
                          // Firefox needs data set or the drag never starts.
                          e.dataTransfer.setData("text/plain", album.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            nudge(album.id, -1);
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            nudge(album.id, 1);
                          }
                        }}
                        disabled={pending}
                        aria-label={`Reorder ${album.title}. Position ${index + 1} of ${order.length}. Drag, or press the up and down arrow keys.`}
                        title="Drag to reorder"
                        className="flex h-11 w-8 cursor-grab items-center justify-center rounded-[8px] text-[color:var(--kb-line-input)] hover:bg-[color:var(--kb-sand)] hover:text-[color:var(--kb-ink-2)] active:cursor-grabbing disabled:cursor-default"
                      >
                        <GripIcon />
                      </button>
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/admin/${handle}/albums/${album.id}`} className="flex min-w-[200px] items-center gap-3 text-ink no-underline">
                      <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-3)]">
                        {album.coverUrl ? (
                          <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path d="M3 15l4.5-4 4 3.5L15 10l6 5" />
                          </svg>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="font-medium">{album.title}</span>
                        <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                          {album.photoCount + album.videoCount === 0
                            ? "No photos yet"
                            : [album.date ? formatDate(album.date) : null, album.openToMembers ? "attendees can add" : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="mono">{(album.photoCount + album.videoCount).toLocaleString("en-AU")}</td>
                  <td className="mono">{figures.views.toLocaleString("en-AU")}</td>
                  <td className="mono">{figures.downloads.toLocaleString("en-AU")}</td>
                  <td>{album.allowDownload ? "Yes" : "No"}</td>
                  <td>
                    <StatusChip album={album} />
                  </td>
                  <td>
                    <span className="flex items-center justify-end gap-2">
                      {album.status === "draft" ? (
                        <button type="button" disabled={pending} onClick={() => run(() => setAlbumPublishedAction(album.id, true))} className="btn btn-ghost">
                          Publish
                        </button>
                      ) : null}
                      <MoreMenu iconOnly label={`More for ${album.title}`}>
                        <MoreLink href={`/admin/${handle}/albums/${album.id}`}>Open album</MoreLink>
                        <MoreLink href={`/e/${handle}/a/${album.id}`}>See it as an attendee</MoreLink>
                        {/* Dragging doesn't work with a finger in Safari, so moving
                            is also a menu choice (WCAG 2.5.7). */}
                        {index > 0 ? (
                          <MoreButton disabled={pending} onClick={() => nudge(album.id, -1)}>
                            Move up
                          </MoreButton>
                        ) : null}
                        {index < order.length - 1 ? (
                          <MoreButton disabled={pending} onClick={() => nudge(album.id, 1)}>
                            Move down
                          </MoreButton>
                        ) : null}
                        {album.status === "draft" ? (
                          <MoreButton
                            disabled={pending}
                            onClick={() => {
                              setScheduling(scheduling === album.id ? null : album.id);
                              setWhen(isoToBrisbaneInput(album.publishAt));
                            }}
                          >
                            {album.publishAt ? "Reschedule" : "Schedule"}
                          </MoreButton>
                        ) : null}
                        <MoreButton disabled={pending} onClick={() => run(() => setAlbumHiddenAction(album.id, album.status !== "hidden"))}>
                          {album.status === "hidden" ? "Show to attendees again" : "Hide from attendees"}
                        </MoreButton>
                      </MoreMenu>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="m-0 px-4 py-5 text-[14px] text-[color:var(--kb-ink-2)]">No albums match.</p> : null}
      </div>

      {scheduling ? (
        <div className="flex flex-wrap items-end gap-2 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-4">
          <label className="flex flex-col gap-1 text-[14px] font-semibold">
            {byId.get(scheduling)?.title}: go live at
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="input !w-auto" />
          </label>
          <button type="button" disabled={pending || !when} onClick={() => run(() => scheduleAlbumAction(scheduling, when))} className="btn btn-primary">
            Save schedule
          </button>
          {byId.get(scheduling)?.publishAt ? (
            <button type="button" disabled={pending} onClick={() => run(() => scheduleAlbumAction(scheduling, null))} className="btn btn-secondary">
              Clear
            </button>
          ) : null}
          <button type="button" className="btn btn-quiet" onClick={() => setScheduling(null)}>
            Cancel
          </button>
        </div>
      ) : null}

      <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
        Scheduled albums publish within the hour of the time you set. The top album is what attendees see first.
      </p>
    </div>
  );
}

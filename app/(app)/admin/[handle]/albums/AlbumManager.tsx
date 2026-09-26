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
import { formatDate, formatLongDate } from "@/lib/format";
import { eventTypeLabel } from "@/lib/media/event-types";
import type { StackedAlbum } from "@/lib/media/album-list";

/** Local datetime string for an <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  if (album.status === "published") {
    return (
      <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[#eaf5ea] px-3 py-1 text-[14px] font-bold text-[#245c2b]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#2f6b36] opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2f6b36]" />
        </span>
        Live
      </span>
    );
  }
  if (album.status === "hidden") return <span className="soft-chip soft-chip-muted flex-none">Hidden</span>;
  if (album.publishAt) return <span className="soft-chip flex-none">Scheduled</span>;
  return <span className="soft-chip soft-chip-muted flex-none">Draft</span>;
}

/**
 * The committee's control panel for one club's albums: order, state, and when
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

/** Three figures per row, the way the design reads an album's life. */
function Figures({ stats }: { stats: AlbumStats }) {
  const cells: [number, string][] = [
    [stats.views, stats.views === 1 ? "view" : "views"],
    [stats.downloads, stats.downloads === 1 ? "download" : "downloads"],
    [stats.members, stats.members === 1 ? "member" : "members"],
  ];
  return (
    <span className="hidden flex-none gap-5 xl:flex">
      {cells.map(([value, label]) => (
        <span key={label} className="w-[72px] text-center">
          <span className="soft-display block text-[18px] leading-none">{value.toLocaleString("en-AU")}</span>
          <span className="block text-[14px] text-[color:var(--ink-55)]">{label}</span>
        </span>
      ))}
    </span>
  );
}

export function AlbumManager({
  clubId,
  handle,
  albums,
  stats = {},
}: {
  clubId: string;
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
  const [pending, startTransition] = useTransition();

  const byId = new Map(albums.map((a) => [a.id, a]));
  const order = (localOrder ?? albums.map((a) => a.id))
    .map((id) => byId.get(id))
    .filter((a): a is StackedAlbum => a !== undefined);

  const save = (ids: string[]) => {
    setLocalOrder(ids);
    startTransition(async () => {
      const res = await setAlbumOrderAction(clubId, ids);
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

  return (
    <section className="soft-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="soft-display text-[19px]">Manage albums</h2>
        <span className="text-[14px] text-[color:var(--ink-70)]">
          Drag to reorder — the top one is what members see first. Hiding keeps the files.
        </span>
        {message ? <span className="soft-chip ml-auto">{message}</span> : null}
      </div>

      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {order.map((album, index) => {
          const dragging = dragId === album.id;
          const isTarget = overId === album.id && !dragging;
          return (
            <li
              key={album.id}
              onDragOver={(e) => {
                // Only claim the drop if this is one of our rows being moved.
                if (!e.dataTransfer.types.includes("text/plain")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverId(album.id);
              }}
              onDragLeave={() => setOverId((current) => (current === album.id ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                // The id travels on the drag itself rather than in state: that
                // is what dataTransfer is for, and state set during dragstart
                // isn't readable in the same tick.
                const moving = e.dataTransfer.getData("text/plain") || dragId;
                if (moving) moveTo(moving, album.id);
                setDragId(null);
                setOverId(null);
              }}
              className={`flex flex-wrap items-center gap-3 rounded-[16px] border bg-white p-3 transition-[border-color,opacity,transform] ${
                isTarget
                  ? "border-accent shadow-[var(--soft-shadow)]"
                  : "border-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
              } ${dragging ? "opacity-45" : ""}`}
            >
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
                className="flex h-11 w-8 flex-none cursor-grab items-center justify-center rounded-[10px] border-0 bg-transparent text-[color:var(--ink-35)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)] hover:text-[color:var(--ink-70)] active:cursor-grabbing disabled:cursor-default"
              >
                <GripIcon />
              </button>

              <span className="h-[56px] w-[84px] flex-none overflow-hidden rounded-[12px] bg-[color:var(--tone-support)]">
                {album.coverUrl ? <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </span>

              <span className="min-w-[180px] flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/c/${handle}/a/${album.id}`} className="soft-display text-[17px] text-ink no-underline">
                    {album.title}
                  </Link>
                  {eventTypeLabel(album.eventType) ? (
                    <span className="soft-chip soft-chip-muted !py-0.5 !text-[14px]">{eventTypeLabel(album.eventType)}</span>
                  ) : null}
                </span>
                <span className="block text-[14px] text-[color:var(--ink-70)]">
                  {[
                    album.date ? formatDate(album.date) : null,
                    album.photoCount ? `${album.photoCount.toLocaleString("en-AU")} photos` : null,
                    album.videoCount ? `${album.videoCount.toLocaleString("en-AU")} videos` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {album.publishAt ? (
                  <span className="block text-[14px] text-accent-700">Goes live {formatLongDate(album.publishAt)}</span>
                ) : null}
              </span>

              {album.status === "published" ? (
                <Figures stats={stats[album.id] ?? { views: 0, downloads: 0, members: 0 }} />
              ) : (
                <span className="hidden flex-none text-[14px] text-[color:var(--ink-55)] xl:block xl:w-[232px] xl:text-center">
                  {album.status === "hidden" ? "Members can't see it, nothing deleted" : "Nobody can see this yet"}
                </span>
              )}

              <StatusChip album={album} />

              {/* One visible action per row (Publish, for drafts); the rest
                  wait behind the row's menu. */}
              <span className="flex items-center gap-2">
                {album.status === "draft" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setAlbumPublishedAction(album.id, true))}
                    className="btn btn-ghost"
                  >
                    Publish
                  </button>
                ) : null}
                <MoreMenu iconOnly label={`More for ${album.title}`}>
                  <MoreLink href={`/c/${handle}/a/${album.id}`}>Open album</MoreLink>
                  {album.status === "draft" ? (
                    <MoreButton
                      disabled={pending}
                      onClick={() => {
                        setScheduling(scheduling === album.id ? null : album.id);
                        setWhen(toLocalInput(album.publishAt));
                      }}
                    >
                      {album.publishAt ? "Reschedule" : "Schedule"}
                    </MoreButton>
                  ) : null}
                  <MoreButton disabled={pending} onClick={() => run(() => setAlbumHiddenAction(album.id, album.status !== "hidden"))}>
                    {album.status === "hidden" ? "Show to members again" : "Hide from members"}
                  </MoreButton>
                </MoreMenu>
              </span>

              {scheduling === album.id ? (
                <span className="flex w-full flex-wrap items-end gap-2 border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] pt-3">
                  <label className="flex flex-col gap-1 text-[14px] font-bold text-[color:var(--ink-70)]">
                    Go live at
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      className="input !w-auto"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={pending || !when}
                    onClick={() => run(() => scheduleAlbumAction(album.id, when))}
                    className="btn btn-primary btn-sm"
                  >
                    Save schedule
                  </button>
                  {album.publishAt ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => scheduleAlbumAction(album.id, null))}
                      className="btn btn-ghost"
                    >
                      Clear
                    </button>
                  ) : null}
                  <span className="text-[14px] text-[color:var(--ink-55)]">
                    Publishing runs hourly, so it goes live on the hour after this time.
                  </span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { favouriteManyAction, loadAlbumPageAction } from "@/app/(app)/c/[handle]/actions";
import { ProcessingTiles } from "@/components/ProcessingBanner";
import { deleteMediaAction, setAlbumCoverAction } from "@/app/(app)/admin/actions";
import { Dialog } from "@/components/Dialog";
import type { GridItem } from "@/lib/media/queries";

function duration(seconds: number | null): string {
  if (!seconds) return "";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Tile({ item, cover, saved }: { item: GridItem; cover: boolean; saved: boolean }) {
  return (
    <>
      {item.thumbUrl ? (
        // Named by the link around it (see labelFor), so the image itself is
        // decorative. Its alt used to be the raw filename, "edited-.jpg".
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-neutral-400 p-2 text-center text-[14px] text-ink">
          {item.status === "ready" ? "No preview" : item.original_filename || "Not finished"}
        </span>
      )}
      {item.kind === "video" ? (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(25,18,22,0.72)] px-2 py-0.5 text-[14px] font-bold text-white">
          {item.duration_seconds ? duration(item.duration_seconds) : "Video"}
        </span>
      ) : null}
      {cover ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[14px] font-bold text-white">Cover</span>
      ) : null}
      {saved ? (
        <span className="absolute bottom-1.5 right-1.5 text-white drop-shadow" aria-label="Saved">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
            <path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />
          </svg>
        </span>
      ) : null}
      {item.status !== "ready" ? (
        <span className="absolute inset-x-1.5 top-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_14%,white)] px-2 py-0.5 text-center text-[14px] font-bold text-accent-800">
          {item.status === "failed" ? "Failed" : "Processing"}
        </span>
      ) : null}
    </>
  );
}

export function AlbumGrid({
  albumId,
  hrefBase,
  initialItems,
  initialHasMore,
  coverMediaId,
  canManage,
  selectMode = false,
  photoCount,
  videoCount,
  savedIds,
  savedTotal,
  processingCount = 0,
  canDownload = false,
  mineItems = [],
  albumTitle,
}: {
  albumId: string;
  hrefBase: string;
  initialItems: GridItem[];
  initialHasMore: boolean;
  coverMediaId: string | null;
  canManage: boolean;
  selectMode?: boolean;
  photoCount: number;
  videoCount: number;
  savedIds: string[];
  /** Favourites across the whole album, not just the page that's loaded. */
  savedTotal: number;
  /** Files still being processed, which members can't read rows for. */
  processingCount?: number;
  canDownload?: boolean;
  /** Photos in this album the viewer is confirmed in. Empty when they have
      not enrolled or are in none, and then the chip isn't shown. */
  mineItems?: GridItem[];
  albumTitle: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(0);
  const [selecting, setSelecting] = useState(selectMode);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set(savedIds));
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"all" | "mine" | "photo" | "video" | "saved">("all");

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedIds = [...selected];
  const shown =
    kind === "all"
      ? items
      : kind === "mine"
        ? mineItems
        : kind === "saved"
          ? items.filter((item) => saved.has(item.id))
          : items.filter((item) => item.kind === kind);
  const total = photoCount + videoCount;
  // Screen readers hear "Photo 3 of 110 in Bobbies Pics", not "link".
  const positionById = new Map(items.map((item, i) => [item.id, i + 1]));
  const labelFor = (item: GridItem) => {
    const noun = item.kind === "video" ? "Video" : "Photo";
    const at = positionById.get(item.id);
    return at ? `${noun} ${at} of ${total} in ${albumTitle}` : `${noun} in ${albumTitle}`;
  };

  const loadMore = () =>
    startTransition(async () => {
      const next = await loadAlbumPageAction(albumId, page + 1, canManage);
      setItems((current) => [...current, ...next.items.filter((i) => !current.some((c) => c.id === i.id))]);
      setHasMore(next.hasMore);
      setPage(page + 1);
    });

  if (items.length === 0 && processingCount === 0) {
    return <p className="soft-card m-6 p-6 text-[14px] text-[color:var(--ink-70)]">Nothing in this album yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* "Select photos" is everyone's — the whole point of an album is
          taking a handful home. What the bar then offers depends on who you
          are: members favourite and download, the committee also recovers a
          cover and deletes. */}
      <div className="flex min-h-[40px] flex-wrap items-center gap-2 px-4 text-[14px] sm:px-6">
        {selecting ? null : (
          <button type="button" className="soft-btn soft-btn-tonal !min-h-[38px] !px-4 !text-[14px]" onClick={() => setSelecting(true)}>
            Select photos
          </button>
        )}
        {!selecting && message ? <span className="text-[14px] text-[color:var(--ink-70)]">{message}</span> : null}
      </div>

      {selecting ? (
        <div className="sticky bottom-[84px] z-20 mx-4 flex flex-wrap items-center gap-2.5 rounded-[999px] bg-ink px-4 py-2.5 text-white shadow-[0_18px_36px_-10px_rgba(43,34,40,0.5)] sm:bottom-4 sm:mx-6">
          <strong className="text-[14px] font-bold">
            {selected.size} selected
          </strong>

          <button
            type="button"
            className="ml-auto min-h-[40px] cursor-pointer rounded-full border-0 bg-white/[0.16] px-4 text-[14px] font-bold text-white disabled:opacity-50"
            disabled={pending || !selected.size}
            onClick={() =>
              startTransition(async () => {
                const res = await favouriteManyAction(selectedIds);
                if (res.error) return setMessage(res.error);
                setSaved((current) => new Set([...current, ...selectedIds]));
                setMessage(`Saved ${res.saved} to your favourites.`);
                setSelected(new Set());
                setSelecting(false);
                router.refresh();
              })
            }
          >
            Favourite
          </button>

          {canDownload ? (
            <a
              href={`/api/albums/${albumId}/zip?only=${selectedIds.join(",")}`}
              aria-disabled={!selected.size}
              className={`flex min-h-[40px] items-center rounded-full bg-white px-4 text-[14px] font-bold text-accent-800 no-underline ${
                selected.size ? "" : "pointer-events-none opacity-50"
              }`}
            >
              Download
            </a>
          ) : null}

          {canManage && selected.size === 1 ? (
            <button
              type="button"
              className="min-h-[40px] cursor-pointer rounded-full border-0 bg-white/[0.16] px-4 text-[14px] font-bold text-white"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await setAlbumCoverAction(albumId, selectedIds[0]);
                  setMessage(res.error ?? res.message ?? "");
                  if (res.ok) router.refresh();
                })
              }
            >
              Use as cover
            </button>
          ) : null}

          {canManage ? (
            <button
              type="button"
              className="min-h-[40px] cursor-pointer rounded-full border-0 bg-white/[0.16] px-4 text-[14px] font-bold text-white disabled:opacity-50"
              disabled={!selected.size}
              onClick={() => setConfirm(true)}
            >
              Delete
            </button>
          ) : null}

          <button
            type="button"
            className="min-h-[40px] cursor-pointer rounded-full border-0 bg-transparent px-3 text-[14px] font-bold text-white/80"
            onClick={() => {
              setSelected(new Set());
              setSelecting(false);
            }}
          >
            Done
          </button>
        </div>
      ) : null}

      {/* The design's filter row: one pressed chip, the rest quiet. Counts are
          on the chip so you know what you're about to see. */}
      <div className="flex w-full flex-wrap gap-2 px-4 sm:px-6">
        {(
          [
            ["all", `All ${total.toLocaleString("en-AU")}`, true],
            ["mine", `You ${mineItems.length.toLocaleString("en-AU")}`, mineItems.length > 0],
            ["photo", `Photos ${photoCount.toLocaleString("en-AU")}`, photoCount > 0 && videoCount > 0],
            ["video", `Videos ${videoCount.toLocaleString("en-AU")}`, videoCount > 0],
            ["saved", `Favourites ${savedTotal.toLocaleString("en-AU")}`, savedTotal > 0],
          ] as const
        )
          .filter(([, , show]) => show)
          .map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={`soft-btn !min-h-[38px] !px-4 !text-[14px] ${
                kind === value ? "!bg-ink !text-white" : "soft-btn-tonal"
              }`}
            >
              {label}
            </button>
          ))}
      </div>

      <div
        className="grid w-full gap-1 px-1 pb-6 pt-3 sm:gap-1.5 sm:px-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(104px, 14vw, 168px), 1fr))" }}
      >
        {kind !== "saved" && kind !== "mine" ? <ProcessingTiles count={processingCount} /> : null}
        {shown.map((item) =>
          selecting ? (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              aria-pressed={selected.has(item.id)}
              aria-label={labelFor(item)}
              className="relative block aspect-square overflow-hidden rounded-[10px] border-0 bg-bg p-0"
              style={{ outline: selected.has(item.id) ? "3px solid var(--color-accent)" : undefined, outlineOffset: -3 }}
            >
              <Tile item={item} cover={item.id === coverMediaId} saved={saved.has(item.id)} />
            </button>
          ) : (
            <Link
              key={item.id}
              href={`${hrefBase}/${item.id}`}
              aria-label={labelFor(item)}
              className="soft-tile relative block aspect-square !rounded-[10px]"
              scroll={false}
            >
              <Tile item={item} cover={item.id === coverMediaId} saved={saved.has(item.id)} />
            </Link>
          ),
        )}
      </div>

      {shown.length === 0 ? (
        <p className="px-4 pb-6 text-[14px] text-[color:var(--ink-70)] sm:px-6">
          Nothing in this album matches that filter.
        </p>
      ) : null}

      {hasMore && kind !== "mine" ? (
        <button type="button" className="btn btn-secondary mb-6 self-center" disabled={pending} onClick={loadMore}>
          {pending ? "Loading…" : "Load more"}
        </button>
      ) : null}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Delete ${selected.size} ${selected.size === 1 ? "item" : "items"}?`}>
        <p className="text-[15px]">The originals go too. Members who already downloaded a copy keep it.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteMediaAction(selectedIds);
                setMessage(res.error ?? res.message ?? "");
                if (res.ok) {
                  setItems((current) => current.filter((i) => !selected.has(i.id)));
                  setSelected(new Set());
                  setConfirm(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

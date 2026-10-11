"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  purgeAlbumNowAction,
  purgeMediaNowAction,
  restoreAlbumAction,
  restoreMediaAction,
  type ActionState,
} from "@/app/(app)/admin/actions";
import { Dialog } from "@/components/Dialog";

export type BinAlbum = {
  id: string;
  title: string;
  count: number;
  deletedOn: string;
  deletedBy: string | null;
  restoreBy: string;
  daysLeft: number;
};

export type BinItem = {
  id: string;
  kind: string;
  thumbUrl: string | null;
  albumTitle: string;
  deletedOn: string;
  deletedBy: string | null;
  restoreBy: string;
  filename: string | null;
  daysLeft: number;
};

function deletedLine(on: string, by: string | null, until: string): string {
  return `Deleted ${on}${by ? ` by ${by}` : ""} · restore until ${until}`;
}

export function BinView({ eventId, albums, items }: { eventId: string; albums: BinAlbum[]; items: BinItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ title: string; run: () => Promise<ActionState> } | null>(null);

  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.error ?? res.message ?? "");
      setConfirm(null);
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedIds = [...selected];

  const left = (days: number) => (days === 1 ? "1 day left" : `${days} days left`);
  const allItemIds = items.map((item) => item.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              for (const album of albums) {
                const res = await restoreAlbumAction(album.id);
                if (res.error) return res;
              }
              return allItemIds.length ? restoreMediaAction(allItemIds) : { ok: true, message: "Restored" };
            })
          }
        >
          Restore all
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() =>
            setConfirm({
              title: "Empty Recently deleted?",
              run: async () => {
                for (const album of albums) {
                  const res = await purgeAlbumNowAction(album.id);
                  if (res.error) return res;
                }
                return allItemIds.length ? purgeMediaNowAction(eventId, allItemIds) : { ok: true, message: "Emptied" };
              },
            })
          }
        >
          Empty now
        </button>
        {selected.size ? (
          <>
            <span className="ml-2 text-[14px] text-[color:var(--kb-ink-2)]">{selected.size} selected</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => restoreMediaAction(selectedIds))}>
              Restore {selected.size}
            </button>
          </>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {albums.map((album) => (
          <div key={album.id} className="flex flex-col overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
            <span className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 15l4.5-4 4 3.5L15 10l6 5" />
              </svg>
              <span className="mono text-[14px]">{album.count === 1 ? "1 item" : `${album.count} items`}</span>
            </span>
            <div className="flex flex-col gap-3 p-3.5">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">Album: {album.title}</span>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]" title={deletedLine(album.deletedOn, album.deletedBy, album.restoreBy)}>
                  Whole album · {left(album.daysLeft)}
                </span>
              </span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-secondary btn-sm flex-1" disabled={pending} onClick={() => run(() => restoreAlbumAction(album.id))}>
                  Restore
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={pending}
                  aria-label={`Delete ${album.title} for good`}
                  onClick={() => setConfirm({ title: `Delete ${album.title} for good?`, run: () => purgeAlbumNowAction(album.id) })}
                >
                  Delete
                </button>
              </span>
            </div>
          </div>
        ))}
        {items.map((item) => {
          const on = selected.has(item.id);
          const name = item.filename ?? (item.kind === "video" ? "Video" : "Photo");
          return (
            <div
              key={item.id}
              className={`flex flex-col overflow-hidden rounded-[10px] border bg-white ${on ? "border-[color:var(--kb-brand)] shadow-[0_0_0_1px_var(--kb-brand)]" : "border-[color:var(--kb-line)]"}`}
            >
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Select ${name} from ${item.albumTitle}`}
                onClick={() => toggle(item.id)}
                className="relative block aspect-[4/3] bg-[color:var(--kb-sand)]"
              >
                {item.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[14px]">No preview</span>
                )}
              </button>
              <div className="flex flex-col gap-3 p-3.5">
                <span className="flex min-w-0 flex-col">
                  <span className="mono truncate text-[14px] font-medium">{name}</span>
                  <span className="text-[14px] text-[color:var(--kb-ink-3)]" title={deletedLine(item.deletedOn, item.deletedBy, item.restoreBy)}>
                    {item.albumTitle} · {left(item.daysLeft)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-secondary btn-sm flex-1" disabled={pending} onClick={() => run(() => restoreMediaAction([item.id]))}>
                    Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={pending}
                    aria-label={`Delete ${name} for good`}
                    onClick={() => setConfirm({ title: `Delete ${name} for good?`, run: () => purgeMediaNowAction(eventId, [item.id]) })}
                  >
                    Delete
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm?.title ?? ""}>
        <p className="text-[15px]">This can&apos;t be undone. The originals are deleted too.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => confirm && run(confirm.run)}>
            {pending ? "Deleting…" : "Delete for good"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

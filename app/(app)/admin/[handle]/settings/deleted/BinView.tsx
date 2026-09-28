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
};

export type BinItem = {
  id: string;
  kind: string;
  thumbUrl: string | null;
  albumTitle: string;
  deletedOn: string;
  deletedBy: string | null;
  restoreBy: string;
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

  // Tiles grouped by the day they were deleted, newest first.
  const groups: { key: string; line: string; items: BinItem[] }[] = [];
  for (const item of items) {
    const key = `${item.deletedOn}|${item.restoreBy}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, line: `Deleted ${item.deletedOn} · restore until ${item.restoreBy}`, items: [item] });
  }

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p role="status" className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
          {message}
        </p>
      ) : null}

      {albums.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="bin-albums">
          <h2 id="bin-albums" className="text-[16px] font-semibold">
            Albums
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--kb-line)] rounded-[10px] border border-[color:var(--kb-line)] bg-white p-0">
            {albums.map((album) => (
              <li key={album.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-medium">
                    {album.title}
                    <span className="font-normal text-[color:var(--kb-ink-3)]">
                      {" "}
                      · {album.count === 1 ? "1 item" : `${album.count} items`}
                    </span>
                  </span>
                  <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                    {deletedLine(album.deletedOn, album.deletedBy, album.restoreBy)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => restoreAlbumAction(album.id))}>
                    Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={pending}
                    onClick={() => setConfirm({ title: `Delete ${album.title} for good?`, run: () => purgeAlbumNowAction(album.id) })}
                  >
                    Delete now
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="bin-items">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="bin-items" className="text-[16px] font-semibold">
              Photos and videos
            </h2>
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pending || selected.size === 0}
                onClick={() => run(() => restoreMediaAction(selectedIds))}
              >
                Restore{selected.size ? ` ${selected.size}` : ""}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending || selected.size === 0}
                onClick={() =>
                  setConfirm({
                    title: `Delete ${selected.size === 1 ? "1 item" : `${selected.size} items`} for good?`,
                    run: () => purgeMediaNowAction(eventId, selectedIds),
                  })
                }
              >
                Delete now
              </button>
            </span>
          </div>
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <span className="text-[14px] text-[color:var(--kb-ink-3)]">{group.line}</span>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
                {group.items.map((item) => {
                  const on = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${item.kind === "video" ? "Video" : "Photo"} from ${item.albumTitle}${item.deletedBy ? `, deleted by ${item.deletedBy}` : ""}`}
                      onClick={() => toggle(item.id)}
                      className={`relative block aspect-square overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)] ${on ? "outline outline-[3px] outline-offset-[-3px] outline-[color:var(--color-accent)]" : ""}`}
                    >
                      {item.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                        <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[14px]">No preview</span>
                      )}
                      {on ? (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[14px] font-bold text-white">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

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

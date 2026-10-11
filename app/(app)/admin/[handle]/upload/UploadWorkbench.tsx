"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import { useState } from "react";
import { Uploader } from "@/app/(app)/admin/[handle]/albums/[albumId]/Uploader";
import { Segmented } from "@/components/Segmented";
import { NewAlbumPanel } from "./NewAlbumPanel";

type AlbumOption = { id: string; title: string; files: number; coverUrl: string | null; draft: boolean };

/**
 * Upload: where the files go on the left (an album you have, or a new one),
 * the drop zone and the queue on the right. A new album is made first, then
 * its drop zone opens.
 */
export function UploadWorkbench({
  eventId,
  defaultDate,
  albums,
  writable,
}: {
  eventId: string;
  defaultDate: string | null;
  albums: AlbumOption[];
  writable: boolean;
}) {
  const [mode, setMode] = useState<"existing" | "new">(albums.length ? "existing" : "new");
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "");
  const album = albums.find((a) => a.id === albumId) ?? null;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 sm:p-6 lg:max-w-[440px]">
        {albums.length ? (
          <Segmented
            label="Where to"
            value={mode}
            onChange={setMode}
            options={[
              { value: "existing", label: "Existing album" },
              { value: "new", label: "New album" },
            ]}
          />
        ) : null}

        {mode === "existing" && albums.length ? (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[18px] font-semibold">Add to an album</legend>
            {albums.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3 rounded-[8px] border p-2.5 ${
                  option.id === albumId ? "border-[color:var(--kb-brand)] bg-[color:var(--kb-brand-tint)]" : "border-[color:var(--kb-line)] hover:border-[color:var(--kb-line-strong)]"
                }`}
              >
                <input type="radio" name="album" value={option.id} checked={option.id === albumId} onChange={() => setAlbumId(option.id)} className="sr-only" />
                <span className="h-11 w-11 flex-none overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                  {option.coverUrl ? <img src={option.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{option.title}</span>
                  <span className="text-[14px] text-[color:var(--kb-ink-3)]">{option.files.toLocaleString("en-AU")} files</span>
                </span>
                {option.draft ? <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Draft</span> : null}
              </label>
            ))}
          </fieldset>
        ) : writable ? (
          <NewAlbumPanel eventId={eventId} defaultDate={defaultDate} autoFocus={albums.length === 0} />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-4">
        {mode === "existing" && album && writable ? (
          <Uploader key={album.id} albumId={album.id} albumTitle={album.title} />
        ) : (
          <div className="dropzone min-h-[240px] cursor-default gap-2.5 px-5 py-10" aria-hidden>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-3)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
              </svg>
            </span>
            <span className="text-[16px] font-semibold text-[color:var(--kb-ink-2)]">Name the album first</span>
            <span className="text-[14px] text-[color:var(--kb-ink-3)]">The drop zone opens as soon as it&apos;s made.</span>
          </div>
        )}
      </div>
    </div>
  );
}

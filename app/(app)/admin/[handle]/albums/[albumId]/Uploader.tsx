"use client";

import { useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { useUploadQueue } from "@/app/(app)/UploadProvider";
import { ACCEPT_ATTRIBUTE } from "@/lib/media/constants";
import { EMPTY_SNAPSHOT } from "@/lib/media/upload-queue";

const serverSnapshot = () => EMPTY_SNAPSHOT;

export function Uploader({ albumId }: { albumId: string }) {
  const queue = useUploadQueue(albumId);
  const jobs = useSyncExternalStore(queue.subscribe, queue.getSnapshot, serverSnapshot);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const result = queue.add(Array.from(list));
    setRejected(result.rejected);
    setWarnings(result.warnings);
  };

  const totalBytes = jobs.reduce((sum, j) => sum + j.size, 0);
  const sentBytes = jobs.reduce((sum, j) => sum + (j.status === "done" ? j.size : Math.min(j.uploaded, j.size)), 0);
  const pct = totalBytes ? Math.floor((sentBytes / totalBytes) * 100) : 0;
  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "failed");
  const busy = jobs.some((j) => j.status !== "done" && j.status !== "failed");

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <div className="flex flex-col gap-3">
        <span className="soft-display text-[18px]">Add photos and videos</span>
        <div
          className="dropzone px-4 py-8"
          data-active={dragging}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="soft-display text-[16px]">Drop files, or choose from your phone</span>
          <span className="text-[14px] text-[color:var(--ink-70)]">JPG, PNG, HEIC, WebP, MP4, MOV · originals kept at full quality</span>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex flex-col gap-2 soft-card p-4">
          <span className="text-[14px] font-semibold">You can keep using Klubbies while this runs.</span>
          <span className="text-[14px] leading-normal text-[color:var(--ink-70)]">
            Uploads continue as you move around the app, and a progress box follows you. Leave this tab open until it
            finishes; if your connection drops, each file picks up where it left off.
          </span>
        </div>
        {rejected.length ? <div className="notice">Skipped {rejected.join(", ")}: only photos and videos can be uploaded.</div> : null}
        {warnings.map((w) => (
          <div key={w} className="notice">
            {w}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-semibold">
            {jobs.length === 0
              ? "Nothing queued yet"
              : busy
                ? `Uploading ${jobs.length} ${jobs.length === 1 ? "file" : "files"}`
                : failed.length
                  ? "Some files need another go"
                  : "Upload complete"}
          </span>
          <span className="text-[14px] text-[color:var(--ink-70)]">{jobs.length ? `${pct}%` : ""}</span>
        </div>
        <div className="h-[10px] bg-neutral-300">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="soft-card">
          {jobs.length === 0 ? (
            <p className="m-0 p-3 text-[14px] text-[color:var(--ink-70)]">Files you choose show up here with their status.</p>
          ) : (
            jobs.slice(-40).map((job) => (
              <div key={job.key} className="flex items-center justify-between gap-3 border-b border-divider px-3 py-[10px] last:border-b-0">
                <span className="flex min-w-0 items-center gap-3">
                  {job.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL
                    <img src={job.previewUrl} alt="" className="h-7 w-7 flex-none object-cover" />
                  ) : (
                    <span className="h-7 w-7 flex-none bg-neutral-400" />
                  )}
                  <span className="truncate text-[14px]">{job.name}</span>
                </span>
                <span className="flex flex-none items-center gap-2">
                  <span
                    className="text-[14px] font-bold tracking-[0.06em]"
                    style={{ color: job.status === "failed" ? "var(--color-accent)" : "var(--color-neutral-700)" }}
                  >
                    {job.status === "done"
                      ? job.note
                        ? job.note.toUpperCase()
                        : "READY"
                      : job.status === "failed"
                        ? "FAILED"
                        : job.status === "uploading"
                          ? `${Math.floor((job.uploaded / Math.max(1, job.size)) * 100)}%`
                          : job.status.toUpperCase()}
                  </span>
                  {job.status === "failed" ? (
                    <button type="button" className="btn btn-secondary text-[14px]" onClick={() => queue.retry(job.key)}>
                      Retry
                    </button>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
        {jobs.length ? (
          <span className="text-[14px] text-[color:var(--ink-70)]">
            {done} of {jobs.length} ready{failed.length ? ` · ${failed.length} failed` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

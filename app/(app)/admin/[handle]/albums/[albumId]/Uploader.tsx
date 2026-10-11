"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { useUploadQueue } from "@/app/(app)/UploadProvider";
import { ACCEPT_ATTRIBUTE } from "@/lib/media/constants";
import { EMPTY_SNAPSHOT } from "@/lib/media/upload-queue";
import { formatBytes } from "@/lib/format";

const serverSnapshot = () => EMPTY_SNAPSHOT;

export function Uploader({ albumId, albumTitle }: { albumId: string; albumTitle?: string }) {
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

  // Closing the tab mid-upload loses the files still going; the browser asks first.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // Failures first, so they can't scroll out of the window of recent rows.
  const shown = [...failed, ...jobs.filter((j) => j.status !== "failed").slice(-40)];

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const statusLabel = (job: (typeof jobs)[number]) =>
    job.status === "done"
      ? (job.note ?? "Ready")
      : job.status === "uploading"
          ? `${Math.floor((job.uploaded / Math.max(1, job.size)) * 100)}%`
          : job.status === "queued"
            ? "Waiting"
            : job.status === "preparing"
              ? "Preparing"
              : "Finishing";

  // One centred column: the choose button first, then progress and the files.
  // It used to be two stretched columns with a square grey bar and shouted
  // status labels, which looked unlike the rest of the app.
  const left = Math.max(0, totalBytes - sentBytes);

  return (
    <div className="flex w-full flex-col gap-4" data-upload-panel>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose photos and videos to upload"
        className="dropzone min-h-[240px] gap-2.5 px-5 py-10"
        data-active={dragging}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand)]" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
        </span>
        <span className="text-[18px] font-semibold">
          <span className="[@media(pointer:coarse)]:hidden">Drop photos and videos here</span>
          <span className="hidden [@media(pointer:coarse)]:inline">Add photos and videos</span>
        </span>
        <span className="text-[14px] text-[color:var(--kb-ink-2)]">
          <span className="[@media(pointer:coarse)]:hidden">or </span>
          <span className="font-semibold text-[color:var(--kb-brand-deep)] underline underline-offset-4">choose files</span> · JPEG, HEIC, PNG, WebP, MP4,
          MOV
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {rejected.length ? <div className="notice">Skipped {rejected.join(", ")}: only photos and videos can be uploaded.</div> : null}
      {warnings.map((w) => (
        <div key={w} className="notice">
          {w}
        </div>
      ))}

      {jobs.length ? (
        <section className="flex flex-col gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-4 sm:p-5" aria-label="Uploads">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold">
              {busy
                ? `Uploading${albumTitle ? ` to ${albumTitle}` : ""}`
                : failed.length
                  ? "Some files need another go"
                  : "Upload complete"}
            </h2>
            <span className="mono text-[14px] text-[color:var(--kb-ink-2)]" role="status">
              {done} of {jobs.length}
              {busy && left > 0 ? ` · ${formatBytes(left)} left` : ""}
              {failed.length ? ` · ${failed.length} didn't upload` : ""}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-[3px] bg-[color:var(--kb-sand)]"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="h-full rounded-[3px] bg-[color:var(--kb-brand)] transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          {busy ? <span className="text-[14px] text-[color:var(--kb-ink-3)]">Keep this tab open. You can move around the app.</span> : null}
          {failed.length > 1 && !busy ? (
            <button type="button" className="btn btn-secondary self-start" onClick={() => queue.retryFailed()}>
              Retry all {failed.length}
            </button>
          ) : null}
          <ul className="m-0 flex list-none flex-col p-0">
            {shown.map((job) => {
              const progress = job.status === "done" ? 100 : job.status === "uploading" ? Math.floor((job.uploaded / Math.max(1, job.size)) * 100) : 0;
              return (
                <li key={job.key} className="flex items-center gap-3 border-t border-[color:var(--kb-sand)] py-2.5 first:border-t-0">
                  {job.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL
                    <img src={job.previewUrl} alt="" className="h-10 w-10 flex-none rounded-[6px] object-cover" />
                  ) : (
                    <span className="h-10 w-10 flex-none rounded-[6px] bg-[color:var(--kb-sand)]" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="mono truncate">{job.name}</span>
                      {job.status === "failed" ? null : (
                        <span className={`flex flex-none items-center gap-1 ${job.status === "done" ? "font-semibold text-[color:var(--kb-ok)]" : "text-[color:var(--kb-ink-2)]"}`}>
                          {job.status === "done" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M5 12.5l4.5 4.5L19 7" />
                            </svg>
                          ) : null}
                          {statusLabel(job)}
                        </span>
                      )}
                    </span>
                    {job.status === "failed" && job.error ? (
                      <span className="text-[14px] text-[color:var(--kb-warn)]">{job.error}</span>
                    ) : job.status !== "done" ? (
                      <span className="relative h-1 overflow-hidden rounded-[2px] bg-[color:var(--kb-sand)]" aria-hidden>
                        <span className="absolute inset-y-0 left-0 bg-[color:var(--kb-brand)]" style={{ width: `${progress}%` }} />
                      </span>
                    ) : null}
                  </span>
                  {job.status === "failed" ? (
                    <button type="button" className="btn btn-secondary btn-sm" aria-label={`Retry ${job.name}`} onClick={() => queue.retry(job.key)}>
                      Retry now
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

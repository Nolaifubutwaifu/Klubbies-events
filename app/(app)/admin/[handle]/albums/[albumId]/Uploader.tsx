"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
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
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4" data-upload-panel>
      <div
        className="dropzone gap-3 px-5 py-8"
        data-active={dragging}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="text-[18px] font-semibold">Add photos and videos</span>
        <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
          Choose files
        </button>
        <span className="hidden text-[14px] text-[color:var(--kb-ink-3)] [@media(pointer:fine)]:inline">or drop them here</span>
        <span className="text-[14px] text-[color:var(--kb-ink-3)]">JPG, PNG, HEIC, WebP, MP4 and MOV. Originals kept at full quality.</span>
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

      {rejected.length ? <div className="notice">Skipped {rejected.join(", ")}: only photos and videos can be uploaded.</div> : null}
      {warnings.map((w) => (
        <div key={w} className="notice">
          {w}
        </div>
      ))}

      {jobs.length ? (
        <section className="soft-card flex flex-col gap-3 p-4 sm:p-5" aria-label="Uploads">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">
              {busy
                ? `Uploading ${jobs.length} ${jobs.length === 1 ? "file" : "files"}`
                : failed.length
                  ? "Some files need another go"
                  : "Upload complete"}
            </span>
            <span className="text-[14px] tabular-nums text-[color:var(--kb-ink-2)]">{pct}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[color:var(--kb-sand)]"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="h-full rounded-full bg-[color:var(--kb-ember)] transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[14px] text-[color:var(--kb-ink-2)]" role="status">
            {done} of {jobs.length} ready{failed.length ? ` · ${failed.length} didn't upload` : ""}
            {busy ? " · keep this page open, you can move around the app" : ""}
          </span>
          {failed.length > 1 && !busy ? (
            <button type="button" className="btn btn-secondary self-start" onClick={() => queue.retryFailed()}>
              Retry all {failed.length}
            </button>
          ) : null}
          <ul className="m-0 flex list-none flex-col p-0">
            {shown.map((job) => (
              <li key={job.key} className="flex items-center gap-3 border-t border-[color:var(--kb-line)] py-2.5 first:border-t-0">
                {job.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL
                  <img src={job.previewUrl} alt="" className="h-10 w-10 flex-none rounded-[8px] object-cover" />
                ) : (
                  <span className="h-10 w-10 flex-none rounded-[8px] bg-[color:var(--kb-sand)]" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px]">{job.name}</span>
                  {job.status === "failed" && job.error ? <span className="kb-error">{job.error}</span> : null}
                </span>
                {job.status === "failed" ? null : (
                  <span
                    className="flex-none text-[14px] font-medium tabular-nums"
                    style={{ color: job.status === "done" ? "#1f6b3a" : "var(--kb-ink-2)" }}
                  >
                    {statusLabel(job)}
                  </span>
                )}
                {job.status === "failed" ? (
                  <button type="button" className="btn btn-secondary btn-sm" aria-label={`Retry ${job.name}`} onClick={() => queue.retry(job.key)}>
                    Retry
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

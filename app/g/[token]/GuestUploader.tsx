"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { ACCEPT_ATTRIBUTE } from "@/lib/media/constants";
import { EMPTY_GUEST_SNAPSHOT, GuestUploadQueue } from "@/lib/media/guest-queue";

const serverSnapshot = () => EMPTY_GUEST_SNAPSHOT;

export function GuestUploader({ token }: { token: string }) {
  const queue = useMemo(() => new GuestUploadQueue(token), [token]);
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

  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "failed");
  const busy = jobs.some((j) => j.status !== "done" && j.status !== "failed");
  const pct = jobs.length ? Math.floor((jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length) * 100) : 0;

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        aria-label="Choose photos and videos to upload"
        className="dropzone min-h-[240px] gap-2.5 px-5 py-10"
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
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember)]" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
        </span>
        <span className="text-[18px] font-semibold">
          <span className="[@media(pointer:coarse)]:hidden">Drop your photos and videos here</span>
          <span className="hidden [@media(pointer:coarse)]:inline">Add your photos and videos</span>
        </span>
        <span className="text-[14px] text-[color:var(--kb-ink-2)]">Full resolution photos and videos, as many as you like. HEIC, JPG, PNG, WebP, MP4, MOV.</span>
        <span className="btn btn-secondary mt-1">Choose files</span>
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

      {rejected.length ? (
        <div className="notice">Skipped {rejected.join(", ")}: only photos and videos can be uploaded.</div>
      ) : null}
      {warnings.map((w) => (
        <div key={w} className="notice">
          {w}
        </div>
      ))}

      {jobs.length ? (
        <section aria-label="Uploads" className="flex flex-col gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold">
              {busy ? `Uploading ${done} of ${jobs.length}` : failed.length ? "Some files need another go" : "All done"}
            </h2>
            <span className="mono text-[14px] text-[color:var(--kb-ink-2)]" role="status">
              {pct}%{failed.length ? ` · ${failed.length} failed` : ""}
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
            <div className="h-full rounded-[3px] bg-[color:var(--kb-ember)] transition-[width]" style={{ width: `${pct}%` }} />
          </div>

          <div className="flex flex-col">
            {jobs.slice(-30).map((job) => (
              <div key={job.key} className="flex items-center gap-3 border-t border-[color:var(--kb-sand)] py-2.5 first:border-t-0">
                {job.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL
                  <img src={job.previewUrl} alt="" className="h-10 w-10 flex-none rounded-[6px] object-cover" />
                ) : (
                  <span className="h-10 w-10 flex-none rounded-[6px] bg-[color:var(--kb-sand)]" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="mono truncate">{job.name}</span>
                    <span
                      className={`flex-none ${job.status === "done" ? "font-semibold text-[color:var(--kb-ok)]" : job.status === "failed" ? "font-semibold text-[color:var(--kb-warn)]" : "text-[color:var(--kb-ink-2)]"}`}
                    >
                      {job.status === "done" ? "Done" : job.status === "failed" ? "Failed" : `${Math.floor(job.progress * 100)}%`}
                    </span>
                  </span>
                  {job.status === "failed" ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] text-[color:var(--kb-warn)]">{job.error}</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => queue.retry(job.key)}>
                        Retry now
                      </button>
                    </span>
                  ) : job.status !== "done" ? (
                    <span className="block h-1 overflow-hidden rounded-[2px] bg-[color:var(--kb-sand)]">
                      <span className="block h-full bg-[color:var(--kb-ember)] transition-[width]" style={{ width: `${Math.floor(job.progress * 100)}%` }} />
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

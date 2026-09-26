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
        className="dropzone px-4 py-10"
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
        <span className="soft-display text-[19px]">Drop photos and videos here</span>
        <span className="text-[14px] text-[color:var(--ink-70)]">
          HEIC, JPG, PNG, WebP, MP4, MOV — originals, kept at full quality
        </span>
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
        <div className="soft-card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="soft-display text-[17px]">
              {busy ? `Uploading ${jobs.length} ${jobs.length === 1 ? "file" : "files"}` : failed.length ? "Some files need another go" : "All done"}
            </span>
            <span className="text-[14px] text-[color:var(--ink-70)]">{pct}%</span>
          </div>
          <div className="h-[8px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--color-accent-600), var(--color-accent-800))" }}
            />
          </div>
          <span className="text-[14px] text-[color:var(--ink-70)]">
            {done} of {jobs.length} done{failed.length ? ` · ${failed.length} failed` : ""}
            {busy ? " · keep this tab open" : ""}
          </span>

          <div className="flex flex-col">
            {jobs.slice(-30).map((job) => (
              <div
                key={job.key}
                className="flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--color-text)_7%,transparent)] py-2.5 last:border-b-0"
              >
                {job.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL
                  <img src={job.previewUrl} alt="" className="h-10 w-10 flex-none rounded-[10px] object-cover" />
                ) : (
                  <span className="h-10 w-10 flex-none rounded-[10px] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold">{job.name}</span>
                    <span
                      className="flex-none text-[14px] font-bold"
                      style={{ color: job.status === "failed" ? "var(--color-accent-700)" : "var(--color-neutral-700)" }}
                    >
                      {job.status === "done" ? "Done" : job.status === "failed" ? "Failed" : `${Math.floor(job.progress * 100)}%`}
                    </span>
                  </span>
                  {job.status === "failed" ? (
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="text-[14px] text-accent-800">{job.error}</span>
                      <button type="button" className="soft-btn soft-btn-tonal !min-h-[32px] !px-3 !text-[14px]" onClick={() => queue.retry(job.key)}>
                        Retry
                      </button>
                    </span>
                  ) : (
                    <span className="mt-1 block h-[5px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]">
                      <span
                        className="block h-full rounded-full bg-accent transition-[width]"
                        style={{ width: `${Math.floor(job.progress * 100)}%` }}
                      />
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

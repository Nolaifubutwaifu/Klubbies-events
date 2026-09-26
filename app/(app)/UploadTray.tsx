"use client";

import { useEffect } from "react";
import { useUploadJobs } from "./UploadProvider";

/**
 * Follows uploads around the app, so an admin can keep browsing while a big
 * album finishes. Closing the tab still stops the transfer, which the tray
 * says out loud.
 */
export function UploadTray() {
  const jobs = useUploadJobs();
  const busy = jobs.filter((j) => j.status !== "done" && j.status !== "failed");
  const failed = jobs.filter((j) => j.status === "failed");

  useEffect(() => {
    if (busy.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy.length]);

  if (busy.length === 0) return null;

  const totalBytes = jobs.reduce((sum, j) => sum + j.size, 0);
  const sentBytes = jobs.reduce((sum, j) => sum + (j.status === "done" ? j.size : Math.min(j.uploaded, j.size)), 0);
  const pct = totalBytes ? Math.floor((sentBytes / totalBytes) * 100) : 0;
  const done = jobs.filter((j) => j.status === "done").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[300px] max-w-[92vw] border-2 border-ink bg-bg shadow-lg">
      <div className="flex items-center justify-between px-3 pt-3 text-[14px] font-semibold">
        <span>
          Uploading {busy.length} {busy.length === 1 ? "file" : "files"}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mx-3 mt-2 h-[8px] bg-neutral-300">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="m-0 px-3 py-2 text-[14px] leading-normal text-ink-70">
        {done} of {jobs.length} done{failed.length ? ` · ${failed.length} failed` : ""}. Keep this tab open until it
        finishes; you can browse other pages.
      </p>
    </div>
  );
}

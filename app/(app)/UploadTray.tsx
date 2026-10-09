"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useUploadJobs } from "./UploadProvider";

// The album's own upload panel shows the same progress in full, so the tray
// steps aside while one is on screen.
const panelOpen = () => typeof document !== "undefined" && Boolean(document.querySelector("[data-upload-panel]"));
const subscribePanel = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
};

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

  const panel = useSyncExternalStore(subscribePanel, panelOpen, () => false);
  if (busy.length === 0 || panel) return null;

  const totalBytes = jobs.reduce((sum, j) => sum + j.size, 0);
  const sentBytes = jobs.reduce((sum, j) => sum + (j.status === "done" ? j.size : Math.min(j.uploaded, j.size)), 0);
  const pct = totalBytes ? Math.floor((sentBytes / totalBytes) * 100) : 0;
  const done = jobs.filter((j) => j.status === "done").length;

  return (
    // Above the attendee tab bar on a phone, so it never covers the tabs.
    <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-4 z-40 w-[300px] max-w-[92vw] rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white shadow-[0_18px_40px_-18px_rgb(22_24_29/0.35)] md:bottom-4">
      <div className="flex items-center justify-between px-3 pt-3 text-[14px] font-semibold">
        <span>
          Uploading {busy.length} {busy.length === 1 ? "file" : "files"}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mx-3 mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--kb-sand)]" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-[color:var(--kb-ember)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="m-0 px-3 py-2 text-[14px] leading-normal text-ink-70" role="status">
        {done} of {jobs.length} done{failed.length ? ` · ${failed.length} failed` : ""}. Keep this tab open until it
        finishes; you can browse other pages.
      </p>
    </div>
  );
}

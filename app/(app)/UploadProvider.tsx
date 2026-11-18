"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { EMPTY_SNAPSHOT, UploadQueue, type JobView } from "@/lib/media/upload-queue";
import { tellAppBusy } from "@/lib/native-app";

// One queue per album, kept above the page so uploads keep running while the
// member moves around the app.

/** While files land, the album on screen refreshes at most this often. */
const LIVE_REFRESH_MS = 6000;

type Registry = {
  queues: Map<string, UploadQueue>;
  listeners: Set<() => void>;
  snapshot: readonly JobView[];
  busy: boolean;
};

const UploadContext = createContext<{
  queueFor: (albumId: string) => UploadQueue;
  useAllJobs: () => readonly JobView[];
  retryAllFailed: () => void;
  clearAllFailed: () => void;
} | null>(null);

type ScreenLock = { release(): Promise<void>; addEventListener(type: "release", listener: () => void): void };
type WakeLockApi = { request(type: "screen"): Promise<ScreenLock> };

/**
 * A phone that locks mid-upload pauses the page, and the transfer with it.
 * While anything is uploading the screen stays on, as a video app's does.
 * iOS lets go of the lock whenever the page is hidden, so it is taken again
 * on the way back.
 */
function holdScreenOn(lockRef: { current: ScreenLock | null }, stillBusy: () => boolean, on: boolean) {
  if (!on) {
    void lockRef.current?.release().catch(() => undefined);
    lockRef.current = null;
    return;
  }
  if (lockRef.current || document.visibilityState !== "visible") return;
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  if (!api) return;
  api
    .request("screen")
    .then((lock) => {
      if (!stillBusy()) return void lock.release().catch(() => undefined);
      lockRef.current = lock;
      lock.addEventListener("release", () => {
        if (lockRef.current === lock) lockRef.current = null;
      });
    })
    .catch(() => undefined); // Low Power Mode, or not allowed: uploads still run.
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const registry = useRef<Registry>({ queues: new Map(), listeners: new Set(), snapshot: EMPTY_SNAPSHOT, busy: false });
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  }, [pathname]);
  const lastRefresh = useRef(0);
  const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A finished file shows up in its album without leaving the page: refresh
  // the album you're looking at, at most every few seconds while a big batch
  // lands. Nothing happens on other pages; the idle refresh covers those.
  const showLanded = (albumId: string) => {
    if (!here.current.includes(albumId) || pendingRefresh.current) return;
    const wait = Math.max(0, lastRefresh.current + LIVE_REFRESH_MS - Date.now());
    pendingRefresh.current = setTimeout(() => {
      pendingRefresh.current = null;
      lastRefresh.current = Date.now();
      if (here.current.includes(albumId)) router.refresh();
    }, wait);
  };

  const wakeLock = useRef<ScreenLock | null>(null);
  const holdScreen = (on: boolean) => holdScreenOn(wakeLock, () => registry.current.busy, on);

  // Back on the page, or back online: files the drop stopped carry on by
  // themselves instead of waiting for Retry.
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      registry.current.queues.forEach((queue) => queue.resumeInterrupted());
      if (registry.current.busy) holdScreenOn(wakeLock, () => registry.current.busy, true);
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", resume);
      holdScreenOn(wakeLock, () => false, false);
    };
  }, []);

  const recompute = () => {
    const all: JobView[] = [];
    for (const queue of registry.current.queues.values()) all.push(...queue.getSnapshot());
    registry.current.snapshot = all;
    const busy = all.some((job) => job.status !== "done" && job.status !== "failed");
    if (busy !== registry.current.busy) {
      registry.current.busy = busy;
      tellAppBusy(busy);
      holdScreen(busy);
    }
    for (const listener of registry.current.listeners) listener();
  };

  const queueFor = (albumId: string) => {
    const existing = registry.current.queues.get(albumId);
    if (existing) return existing;
    const queue = new UploadQueue(
      albumId,
      () => router.refresh(),
      () => showLanded(albumId),
    );
    queue.subscribe(recompute);
    registry.current.queues.set(albumId, queue);
    return queue;
  };

  const useAllJobs = () =>
    useSyncExternalStore(
      (listener) => {
        registry.current.listeners.add(listener);
        return () => registry.current.listeners.delete(listener);
      },
      () => registry.current.snapshot,
      () => EMPTY_SNAPSHOT,
    );

  const retryAllFailed = () => registry.current.queues.forEach((queue) => queue.retryFailed());
  const clearAllFailed = () => registry.current.queues.forEach((queue) => queue.clearFailed());

  return <UploadContext.Provider value={{ queueFor, useAllJobs, retryAllFailed, clearAllFailed }}>{children}</UploadContext.Provider>;
}

export function useUploadQueue(albumId: string): UploadQueue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("UploadProvider is missing");
  return ctx.queueFor(albumId);
}

/** Retry or give up on every failed file, in every album. */
export function useFailedActions(): { retryAll: () => void; clearAll: () => void } {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("UploadProvider is missing");
  return { retryAll: ctx.retryAllFailed, clearAll: ctx.clearAllFailed };
}

export function useUploadJobs(): readonly JobView[] {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("UploadProvider is missing");
  return ctx.useAllJobs();
}

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
} | null>(null);

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

  const recompute = () => {
    const all: JobView[] = [];
    for (const queue of registry.current.queues.values()) all.push(...queue.getSnapshot());
    registry.current.snapshot = all;
    const busy = all.some((job) => job.status !== "done" && job.status !== "failed");
    if (busy !== registry.current.busy) {
      registry.current.busy = busy;
      tellAppBusy(busy);
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

  return <UploadContext.Provider value={{ queueFor, useAllJobs }}>{children}</UploadContext.Provider>;
}

export function useUploadQueue(albumId: string): UploadQueue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("UploadProvider is missing");
  return ctx.queueFor(albumId);
}

export function useUploadJobs(): readonly JobView[] {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("UploadProvider is missing");
  return ctx.useAllJobs();
}

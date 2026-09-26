"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from "react";
import { EMPTY_SNAPSHOT, UploadQueue, type JobView } from "@/lib/media/upload-queue";

// One queue per album, kept above the page so uploads keep running while the
// member moves around the app.

type Registry = {
  queues: Map<string, UploadQueue>;
  listeners: Set<() => void>;
  snapshot: readonly JobView[];
};

const UploadContext = createContext<{
  queueFor: (albumId: string) => UploadQueue;
  useAllJobs: () => readonly JobView[];
} | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const registry = useRef<Registry>({ queues: new Map(), listeners: new Set(), snapshot: EMPTY_SNAPSHOT });

  const recompute = () => {
    const all: JobView[] = [];
    for (const queue of registry.current.queues.values()) all.push(...queue.getSnapshot());
    registry.current.snapshot = all;
    for (const listener of registry.current.listeners) listener();
  };

  const queueFor = (albumId: string) => {
    const existing = registry.current.queues.get(albumId);
    if (existing) return existing;
    const queue = new UploadQueue(albumId, () => router.refresh());
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

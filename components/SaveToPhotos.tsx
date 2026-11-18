"use client";

import { useState, useSyncExternalStore } from "react";
import { nativeSaveToPhotos } from "@/lib/native-app";
import { isUploadRetryable, withBackoff } from "@/lib/retry";

// "Save to Photos" for any set of items: the album, a selection, favourites,
// photos of you, or the one photo in the viewer.
//
// A phone browser has no way to write into the Photos app except the share
// sheet, which offers "Save N Images". Inside the iPhone app there is no share
// sheet step: the app saves each batch into Photos itself.
//
// iOS only opens the share sheet within a few seconds of a tap, and a video
// takes longer than that to download, so when Safari refuses, the downloaded
// batch waits behind a "Save N items to Photos" button and the next tap
// shares it straight away. Later batches (there is no tap before them at all)
// go the same way.

const SHARE_BATCH = 8;
const subscribeNever = () => () => {};
/** Safari reports a dropped connection as a TypeError ("Load failed"), which is worth another go. */
const fetchRetryable = (error: unknown) => error instanceof TypeError || isUploadRetryable(error);

function shareTakes(name: string, type: string): boolean {
  try {
    const probe = new File([new Blob([new Uint8Array([1])])], name, { type });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

/**
 * A phone or tablet. Mac Safari and desktop Chrome share files too, but a
 * laptop wants the file in Downloads, not a share sheet.
 */
function touchScreen(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}

/** True where items can go straight into the Photos app: the iPhone app, or a phone's share sheet that takes files. */
const canSaveSnapshot = () => Boolean(nativeSaveToPhotos()) || (touchScreen() && shareTakes("probe.jpg", "image/jpeg"));
/** The same for a video, which some share sheets refuse while taking photos. */
const canSaveVideoSnapshot = () => Boolean(nativeSaveToPhotos()) || (touchScreen() && shareTakes("probe.mp4", "video/mp4"));

export function useCanSaveToPhotos(kind: "photo" | "video" = "photo"): boolean {
  return useSyncExternalStore(subscribeNever, kind === "video" ? canSaveVideoSnapshot : canSaveSnapshot, () => false);
}

type Waiting = { files: File[]; next: number; skippedVideos: number; unavailable: number };

export type SaveToPhotosState = {
  busy: boolean;
  progress: string;
  error: string;
  /** A downloaded batch waiting for a tap. */
  waiting: Waiting | null;
  start: () => void;
  shareWaiting: () => void;
};

export function useSaveToPhotos(mediaIds: readonly string[]): SaveToPhotosState {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  // A different set (the viewer moved to the next photo): the last one's
  // files and messages don't belong to it.
  const key = mediaIds.join(",");
  const [shownKey, setShownKey] = useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setWaiting(null);
    setProgress("");
    setError("");
  }

  const total = mediaIds.length;
  const noun = (n: number) => (total === 1 ? "it" : `${n} ${n === 1 ? "item" : "items"}`);

  function finish(nativeSaved: number | null, skippedVideos: number, unavailable: number) {
    const left = unavailable > 0 ? ` ${unavailable === 1 ? "1 item has" : `${unavailable} items have`} downloads turned off.` : "";
    setProgress(
      nativeSaved !== null
        ? nativeSaved === total
          ? total === 1
            ? "Saved to Photos"
            : `Saved all ${nativeSaved} to Photos`
          : `Saved ${nativeSaved} of ${total} to Photos.${left || " The rest couldn't be saved; try Download on a computer."}`
        : skippedVideos > 0
          ? `Done. ${skippedVideos === 1 ? "1 video" : `${skippedVideos} videos`} couldn't go to Photos from here: open ${skippedVideos === 1 ? "it" : "each one"} and tap Download.${left}`
          : `Done.${left}`,
    );
  }

  function fail(shareError: unknown) {
    const message = shareError instanceof Error ? shareError.message : String(shareError);
    const name = shareError instanceof Error ? shareError.name : "";
    if (/photos access/i.test(message)) setError(message);
    else if (name !== "AbortError" && !/abort/i.test(message)) setError("Saving stopped. Tap Save to Photos to try again.");
    setProgress("");
  }

  async function run(from: number, skippedBefore: number, unavailableBefore: number) {
    setBusy(true);
    setError("");
    setWaiting(null);
    const native = nativeSaveToPhotos();
    let saved = 0;
    let skippedVideos = skippedBefore;
    let unavailable = unavailableBefore;
    try {
      for (let i = from; i < total; i += SHARE_BATCH) {
        const batch = mediaIds.slice(i, i + SHARE_BATCH);
        const last = Math.min(i + SHARE_BATCH, total);
        setProgress(total === 1 ? "Getting it ready…" : `Preparing ${i + 1} to ${last} of ${total}`);
        const urls = await withBackoff(async () => {
          const res = await fetch("/api/media/sign", {
            method: "POST",
            headers: { "content-type": "application/json" },
            // The app saves the real files, videos included. The share sheet
            // gets display copies of photos and the real file of each video:
            // a video's display copy is its poster, a still image.
            body: JSON.stringify({ mediaIds: batch, variant: native ? "original" : "share" }),
          });
          if (!res.ok) throw Object.assign(new Error(`sign ${res.status}`), { status: res.status });
          return ((await res.json()) as { urls: Record<string, string> }).urls;
        }, fetchRetryable);
        unavailable += batch.filter((id) => !urls[id]).length;
        if (native) {
          const batchUrls = batch.map((id) => urls[id]).filter((url): url is string => Boolean(url));
          if (batchUrls.length === 0) continue;
          setProgress(total === 1 ? "Saving to Photos…" : `Saving ${last} of ${total}… keep the app open`);
          const result = (await native.postMessage({ urls: batchUrls })) as { saved?: number };
          saved += result?.saved ?? 0;
          continue;
        }
        const files: File[] = [];
        for (const [n, id] of batch.entries()) {
          const url = urls[id];
          if (!url) continue;
          if (total > 1) setProgress(`Downloading ${i + n + 1} of ${total}…`);
          const blob = await withBackoff(async () => {
            const res = await fetch(url);
            if (!res.ok) throw Object.assign(new Error(`download ${res.status}`), { status: res.status });
            return res.blob();
          }, fetchRetryable);
          const file = shareFile(blob, id);
          // A phone that can't take this video in the share sheet still
          // saves the photos; the video is left for Download.
          if (file.type.startsWith("video/") && !navigator.canShare?.({ files: [file] })) {
            skippedVideos++;
            continue;
          }
          files.push(file);
        }
        if (files.length === 0) continue;
        setProgress(`Saving ${noun(files.length)}…`);
        try {
          await navigator.share({ files, title: "Klubbies Events" });
        } catch (shareError) {
          if (shareError instanceof Error && shareError.name === "NotAllowedError") {
            setWaiting({ files, next: i + SHARE_BATCH, skippedVideos, unavailable });
            setProgress(total === 1 ? "Ready. Tap below to save it to Photos." : `Downloaded ${last} of ${total}. Tap below to save them to Photos.`);
            return;
          }
          throw shareError;
        }
      }
      finish(native ? saved : null, skippedVideos, unavailable);
    } catch (shareError) {
      fail(shareError);
    } finally {
      setBusy(false);
    }
  }

  async function shareWaiting() {
    if (!waiting) return;
    const { files, next, skippedVideos, unavailable } = waiting;
    setBusy(true);
    setError("");
    try {
      // No await before this: it has to run inside the tap.
      await navigator.share({ files, title: "Klubbies Events" });
      setWaiting(null);
      if (next < total) await run(next, skippedVideos, unavailable);
      else finish(null, skippedVideos, unavailable);
    } catch (shareError) {
      // Cancelling the sheet leaves the button, so they can try again.
      if (!(shareError instanceof Error && shareError.name === "AbortError")) {
        setWaiting(null);
        fail(shareError);
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    progress,
    error,
    waiting,
    start: () => void run(0, 0, 0),
    shareWaiting: () => void shareWaiting(),
  };
}

/** Progress, the error, and the "Save N items" button when a batch is waiting for a tap. */
export function SaveToPhotosStatus({ state, className = "" }: { state: SaveToPhotosState; className?: string }) {
  const { progress, error, waiting, busy, shareWaiting } = state;
  if (!progress && !error && !waiting) return null;
  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      {progress ? (
        <span className="kb-help" role="status">
          {progress}
        </span>
      ) : null}
      {error ? <span className="kb-error">{error}</span> : null}
      {waiting ? (
        <button type="button" className="btn btn-primary !min-h-[48px]" onClick={shareWaiting} disabled={busy}>
          <PhotosIcon />
          Save {waiting.files.length === 1 ? "it" : `${waiting.files.length} items`} to Photos
        </button>
      ) : null}
    </div>
  );
}

/**
 * A Save to Photos button with its status underneath, for pages that offer it
 * beside a zip download. Nothing at all where the phone can't do it, so the
 * zip stays the only choice on a laptop.
 */
export function SaveToPhotosButton({
  mediaIds,
  label = "Save to Photos",
  className = "btn btn-primary no-underline",
  statusClassName,
}: {
  mediaIds: readonly string[];
  label?: string;
  className?: string;
  statusClassName?: string;
}) {
  const canSave = useCanSaveToPhotos();
  const state = useSaveToPhotos(mediaIds);
  if (!canSave || mediaIds.length === 0) return null;
  return (
    <>
      <button type="button" className={className} onClick={state.start} disabled={state.busy}>
        <PhotosIcon />
        {state.busy ? "Saving…" : label}
      </button>
      <SaveToPhotosStatus state={state} className={statusClassName} />
    </>
  );
}

export function PhotosIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

const SHARE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "video/quicktime": "mov",
  "video/mp4": "mp4",
};

/** Names a downloaded file by its real type, so Photos files a video as a video. */
function shareFile(blob: Blob, id: string): File {
  const type = blob.type in SHARE_EXT ? blob.type : blob.type.startsWith("video/") ? "video/mp4" : "image/jpeg";
  return new File([blob], `klubbies-${id.slice(0, 8)}.${SHARE_EXT[type]}`, { type });
}

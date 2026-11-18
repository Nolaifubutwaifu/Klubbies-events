"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { setAlbumPublishedAction } from "@/app/(app)/admin/actions";
import { MoreButton, MoreLink, MoreMenu, MoreSeparator } from "@/components/MoreMenu";
import { formatBytes } from "@/lib/format";
import { nativeSaveToPhotos } from "@/lib/native-app";

const SHARE_BATCH = 8;
/** Fired by the Select button; the album grid below listens and starts selecting. */
export const SELECT_EVENT = "kb:album-select";
const subscribeNever = () => () => {};

/**
 * True where photos can go straight into the Photos app: inside the iPhone
 * app, or where the share sheet accepts files, which is how iOS Safari does it.
 */
function canShareSnapshot(): boolean {
  if (nativeSaveToPhotos()) return true;
  try {
    const probe = new File([new Blob([new Uint8Array([1])])], "probe.jpg", { type: "image/jpeg" });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

/**
 * The album header's actions: one button for the thing this person most
 * likely came to do, and a More menu for the rest.
 *
 *   member                      → Save to Photos (phone) or Download all
 *   committee, draft            → Publish album
 *   committee, published        → Add photos
 *
 * "Save to Photos" hands batches of files to the phone's share sheet, which
 * offers "Save N Images" straight into the Photos app. Laptops get the zip,
 * in parts for very large albums. Inside the iPhone app there is no share
 * sheet step: the app saves each batch into Photos itself.
 */
export function AlbumActions({
  albumId,
  mediaIds,
  parts,
  partBytes = [],
  canDownload,
  canManage,
  canAdd,
  published,
  albumHref,
  editing,
  adding,
}: {
  albumId: string;
  mediaIds: string[];
  parts: number;
  partBytes?: number[];
  canDownload: boolean;
  canManage: boolean;
  canAdd: boolean;
  published: boolean;
  albumHref: string;
  editing: boolean;
  adding: boolean;
}) {
  const router = useRouter();
  const canShareFiles = useSyncExternalStore(subscribeNever, canShareSnapshot, () => false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const ready = mediaIds.length;
  const addHref = `${albumHref}?add=1`;
  const editHref = editing ? albumHref : `${albumHref}?edit=1`;
  const zipHref = (part: number) => `/api/albums/${albumId}/zip${parts > 1 ? `?part=${part}` : ""}`;

  async function saveToPhotos() {
    setBusy(true);
    setError("");
    const native = nativeSaveToPhotos();
    let saved = 0;
    let skippedVideos = 0;
    try {
      for (let i = 0; i < mediaIds.length; i += SHARE_BATCH) {
        const batch = mediaIds.slice(i, i + SHARE_BATCH);
        setProgress(`Preparing ${i + 1} to ${Math.min(i + SHARE_BATCH, mediaIds.length)} of ${mediaIds.length}`);
        const res = await fetch("/api/media/sign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // The app saves the real files, videos included. The share sheet
          // gets display copies of photos and the real file of each video:
          // a video's display copy is its poster, a still image.
          body: JSON.stringify({ mediaIds: batch, variant: native ? "original" : "share" }),
        });
        const { urls }: { urls: Record<string, string>; kinds?: Record<string, string> } = await res.json();
        if (native) {
          const batchUrls = batch.map((id) => urls[id]).filter((url): url is string => Boolean(url));
          setProgress(`Saving ${Math.min(i + SHARE_BATCH, mediaIds.length)} of ${mediaIds.length}… keep the app open`);
          const result = (await native.postMessage({ urls: batchUrls })) as { saved?: number };
          saved += result?.saved ?? 0;
          continue;
        }
        const files: File[] = [];
        for (const id of batch) {
          const url = urls[id];
          if (!url) continue;
          const blob = await (await fetch(url)).blob();
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
        setProgress(`Saving ${files.length} ${files.length === 1 ? "item" : "items"}…`);
        await navigator.share({ files, title: "Klubbies Events" });
      }
      setProgress(
        native
          ? saved === mediaIds.length
            ? `Saved all ${saved} to Photos`
            : `Saved ${saved} of ${mediaIds.length} to Photos. The rest couldn't be saved; try Download all on a computer.`
          : skippedVideos > 0
            ? `Done. ${skippedVideos === 1 ? "1 video" : `${skippedVideos} videos`} couldn't go to Photos from here: open ${skippedVideos === 1 ? "it" : "each one"} and tap Download.`
            : "Done",
      );
    } catch (shareError) {
      const message = shareError instanceof Error ? shareError.message : String(shareError);
      if (/photos access/i.test(message)) setError(message);
      else if (!/abort/i.test(message)) setError("Saving stopped. You can also use Download all.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  function setPublished(next: boolean) {
    startTransition(async () => {
      const res = await setAlbumPublishedAction(albumId, next);
      setError(res.error ?? "");
      if (res.ok) router.refresh();
    });
  }

  const download = canDownload && ready > 0;

  // The one visible button.
  let primary: React.ReactNode = null;
  if (canManage && !published) {
    primary = (
      <button type="button" className="btn btn-primary !min-h-[48px] flex-1 sm:flex-none" disabled={pending || ready === 0} onClick={() => setPublished(true)}>
        {pending ? "Publishing…" : "Publish album"}
      </button>
    );
  } else if (canAdd) {
    primary = (
      <Link href={adding ? albumHref : addHref} className="btn btn-primary !min-h-[48px] flex-1 sm:flex-none">
        {adding ? "Done adding" : "Add photos"}
      </Link>
    );
  } else if (download && canShareFiles) {
    primary = (
      <button type="button" className="btn btn-primary !min-h-[48px] flex-1 sm:flex-none" onClick={saveToPhotos} disabled={busy}>
        <DownloadIcon />
        {busy ? "Saving…" : "Save to Photos"}
      </button>
    );
  } else if (download) {
    primary = (
      <a href={zipHref(0)} className="btn btn-secondary !min-h-[48px] flex-1 no-underline sm:flex-none">
        <DownloadIcon />
        {parts > 1 ? `Part 1 of ${parts}${partBytes[0] ? `, ${formatBytes(partBytes[0])}` : ""}` : "Download album"}
      </a>
    );
  }

  const primaryIsDownload = !canManage && !canAdd;
  const menuItems: React.ReactNode[] = [];
  if (canManage && !published && canAdd) menuItems.push(<MoreLink key="add" href={addHref}>Add photos</MoreLink>);
  if (canManage) menuItems.push(<MoreLink key="edit" href={editHref}>{editing ? "Close details" : "Edit details and cover"}</MoreLink>);
  if (download && canShareFiles && !primaryIsDownload) menuItems.push(<MoreButton key="save" onClick={saveToPhotos}>Save to Photos</MoreButton>);
  if (download) {
    const from = primaryIsDownload && !canShareFiles ? 1 : 0;
    for (let i = from; i < parts; i++) {
      menuItems.push(
        <a key={`zip${i}`} href={zipHref(i)} className="kb-menu-item">
          {parts > 1 ? `Part ${i + 1} of ${parts}${partBytes[i] ? `, ${formatBytes(partBytes[i])}` : ""}` : "Download all"}
        </a>,
      );
    }
  }
  if (canManage && published) {
    menuItems.push(<MoreSeparator key="sep" />);
    menuItems.push(
      <MoreButton key="unpub" danger disabled={pending} onClick={() => setPublished(false)}>
        Unpublish, back to draft
      </MoreButton>,
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex w-full items-center gap-2 max-[359px]:gap-1.5">
        {primary}
        {ready > 0 ? (
          <button type="button" className="btn btn-secondary !min-h-[48px]" onClick={() => window.dispatchEvent(new Event(SELECT_EVENT))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
            Select
          </button>
        ) : null}
        {menuItems.length ? (
          <MoreMenu iconOnly label="More album actions">
            {menuItems}
          </MoreMenu>
        ) : null}
      </div>
      {canManage && !published && ready === 0 ? <span className="kb-help">Upload something first</span> : null}
      {progress ? <span className="kb-help">{progress}</span> : null}
      {error ? <span className="kb-error">{error}</span> : null}
    </div>
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

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAlbumPublishedAction } from "@/app/(app)/admin/actions";
import { MoreButton, MoreLink, MoreMenu, MoreSeparator } from "@/components/MoreMenu";
import { formatBytes } from "@/lib/format";
import { SaveToPhotosStatus, useCanSaveToPhotos, useSaveToPhotos } from "@/components/SaveToPhotos";

/** Fired by the Select button; the album grid below listens and starts selecting. */
export const SELECT_EVENT = "kb:album-select";

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
  const canShareFiles = useCanSaveToPhotos();
  const save = useSaveToPhotos(mediaIds);
  const busy = save.busy;
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const ready = mediaIds.length;
  const addHref = `${albumHref}?add=1`;
  const editHref = editing ? albumHref : `${albumHref}?edit=1`;
  const zipHref = (part: number) => `/api/albums/${albumId}/zip${parts > 1 ? `?part=${part}` : ""}`;

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
      <button type="button" className="btn btn-primary !min-h-[48px] flex-1 sm:flex-none" onClick={save.start} disabled={busy}>
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
  if (download && canShareFiles && !primaryIsDownload) menuItems.push(<MoreButton key="save" onClick={save.start}>Save to Photos</MoreButton>);
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
      <div className="flex w-full items-center gap-2">
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
      <SaveToPhotosStatus state={save} />
      {error ? <span className="kb-error">{error}</span> : null}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

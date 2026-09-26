"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import {
  deleteAlbumAction,
  setAlbumCoverImageAction,
  updateAlbumAction,
  type ActionState,
} from "@/app/(app)/admin/actions";
import { Dialog } from "@/components/Dialog";
import { FormMessage, SubmitButton } from "@/components/forms";
import { createClient } from "@/lib/supabase/client";

type Album = {
  id: string;
  eventId: string;
  title: string;
  albumDate: string | null;
  description: string | null;
  allowDownload: boolean;
  visibility: string;
  contributorScope: string;
  coverUrl: string | null;
  coverSource: string;
};

const AUDIENCE = [
  { value: "members", label: "All attendees" },
  { value: "admins", label: "Organisers only" },
];

const CONTRIBUTORS = [
  { value: "managers", label: "Organisers and photographers" },
  { value: "members", label: "Any attendee" },
];

function Choice({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className="cursor-pointer border-2 px-3 py-[9px] text-[14px] font-semibold"
            style={{
              borderColor: active ? "var(--color-accent)" : "var(--color-divider)",
              background: active ? "var(--color-accent)" : "transparent",
              color: active ? "#ffffff" : "var(--color-text)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function AlbumEditPanel({ album, closeHref, onPickCover }: { album: Album; closeHref: string; onPickCover: string }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(updateAlbumAction.bind(null, album.id), {});
  const [visibility, setVisibility] = useState(album.visibility);
  const [contributorScope, setContributorScope] = useState(album.contributorScope);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const coverInput = useRef<HTMLInputElement>(null);

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setCoverError("Use a PNG, JPG or WebP image");
    if (file.size > 10 * 1024 * 1024) return setCoverError("Covers must be under 10 MB");
    setCoverBusy(true);
    setCoverError("");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `events/${album.eventId}/covers/${album.id}-${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from("event_media").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setCoverBusy(false);
      return setCoverError("Upload failed. Try again.");
    }
    const res = await setAlbumCoverImageAction(album.id, path);
    setCoverBusy(false);
    if (res.error) return setCoverError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 border-b border-[color:var(--kb-line)] p-4 sm:p-6">
      <span className="text-[20px] font-semibold tracking-[-0.02em]">Album details</span>
      <form action={action} className="flex flex-col gap-6">
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div className="flex flex-col gap-4">
            <label className="field">
              Album name
              <input className="input" name="title" defaultValue={album.title} required maxLength={160} />
            </label>
            <label className="field">
              Date (optional)
              <input className="input" name="albumDate" type="date" defaultValue={album.albumDate ?? ""} />
            </label>
            <label className="field">
              Description
              <textarea className="input" name="description" rows={3} defaultValue={album.description ?? ""} maxLength={2000} />
            </label>
            <label className="flex items-center gap-3 text-[14px]">
              <input
                type="checkbox"
                name="allowDownload"
                defaultChecked={album.allowDownload}
              />
              Attendees can download the originals
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Cover</span>
              <div className="flex flex-wrap items-start gap-3">
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={album.coverUrl} alt="" className="w-[150px] rounded-[var(--kb-r-photo)] border border-[color:var(--kb-line)] object-cover" style={{ aspectRatio: "4 / 3" }} />
                ) : (
                  <span className="w-[150px] rounded-[var(--kb-r-photo)] border border-[color:var(--kb-line)] bg-[color:var(--kb-sand)]" style={{ aspectRatio: "4 / 3" }} />
                )}
                <div className="flex min-w-[160px] flex-1 flex-col gap-2">
                  <span className="text-[14px] leading-normal text-ink-70">{album.coverSource}</span>
                  <a href={onPickCover} className="btn btn-ghost text-[14px]">
                    Pick from this album
                  </a>
                  <button
                    type="button"
                    className="dropzone p-3 text-[14px] text-ink-70"
                    onClick={() => coverInput.current?.click()}
                    disabled={coverBusy}
                  >
                    {coverBusy ? "Uploading…" : "Or drop your own cover image"}
                  </button>
                  {coverError ? <span className="notice">{coverError}</span> : null}
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => uploadCover(e.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Who can see this album</span>
              <Choice name="visibility" value={visibility} onChange={setVisibility} options={AUDIENCE} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold">Who can add photos to this album</span>
              <Choice name="contributorScope" value={contributorScope} onChange={setContributorScope} options={CONTRIBUTORS} />
              <span className="max-w-[46ch] text-[14px] leading-normal text-ink-70">
                {contributorScope === "members"
                  ? "Every attendee can add their own photos, so the album fills up from everyone's phones."
                  : "Only organisers, photographers with an account, and upload links can add photos."}
              </span>
            </div>
          </div>
        </div>

        <FormMessage state={state} />
        <div className="hr" />
        <div className="flex flex-wrap gap-3">
          <SubmitButton className="btn btn-primary text-[14px]" pendingText="Saving…">
            Save details
          </SubmitButton>
          <a href={closeHref} className="btn btn-ghost text-[14px]">
            Cancel
          </a>
          <button
            type="button"
            className="btn btn-ghost ml-auto text-[14px] text-accent-700"
            onClick={() => setConfirmDelete(true)}
          >
            Delete album
          </button>
        </div>
      </form>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this album?">
        <p className="text-[15px]">All photos and videos in “{album.title}” are permanently deleted, originals included.</p>
        <label className="field">
          Type the album name to confirm
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending || typed.trim().toLowerCase() !== album.title.trim().toLowerCase()}
            onClick={() => startTransition(async () => void (await deleteAlbumAction(album.id, typed)))}
          >
            {pending ? "Deleting…" : "Delete album"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { enrolFaceAction, withdrawFaceConsentAction } from "@/app/(app)/face-actions";
import { Dialog } from "@/components/Dialog";
import { MEMBER_CONSENT } from "@/lib/faces/copy";

/**
 * Rekognition takes JPEG and PNG only, and lib/media/prepare.ts produces WebP
 * everywhere else in the app, so the selfie needs its own small encode path.
 * 1,000px on the longest edge at quality 90 is plenty for a faceprint.
 */
async function toJpeg(file: File): Promise<File | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return null;
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return null;
  return new File([blob], "selfie.jpg", { type: "image/jpeg" });
}

export function Enrol({ eventId, backHref, page = false }: { eventId: string; backHref?: string; page?: boolean }) {
  const [consented, setConsented] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  async function pick(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const jpeg = await toJpeg(file);
    if (!jpeg) {
      setMessage("We could not read that photo. Try a different one.");
      return;
    }
    setSelfie(jpeg);
    setPreview(URL.createObjectURL(jpeg));
    setMessage("");
  }

  const submit = () =>
    startTransition(async () => {
      if (!selfie) return;
      const res = await enrolFaceAction(eventId, selfie, consented);
      setMessage(res.error ?? res.message ?? "");
    });

  const Title = page ? "h1" : "h2";

  return (
    <div className={`flex w-full max-w-[460px] flex-col gap-6 ${page ? "" : "rounded-[12px] border border-[color:var(--kb-line)] bg-white p-5"}`}>
      {/* Plain and short up front; the full explanation is one tap away
          and must be read the same way before anyone ticks the box. */}
      <div className="flex flex-col gap-2">
        <Title className={page ? "serif text-[40px] leading-[1.02]" : "text-[20px] font-semibold"}>{MEMBER_CONSENT.title}</Title>
        <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">One selfie. Only you see the matches, and you can delete it any time.</p>
      </div>

      {/* The selfie, or the place it goes. */}
      <div className="relative flex h-[210px] w-[210px] items-center justify-center self-center rounded-full bg-[color:var(--kb-sand)]" aria-hidden={!preview}>
        <span className="absolute -inset-2.5 rounded-full border-2 border-dashed border-[color:var(--kb-line-input)]" aria-hidden />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img src={preview} alt="Your selfie" className="h-full w-full rounded-full object-cover" />
        ) : (
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ink-3)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="9" r="4" />
            <path d="M4.5 20.5c0-4 3.4-6.2 7.5-6.2s7.5 2.2 7.5 6.2" />
          </svg>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3.5 rounded-[12px] border border-[color:var(--kb-line)] bg-white p-4">
        <input type="checkbox" checked={consented} onChange={(ev) => setConsented(ev.target.checked)} className="mt-0.5 !h-[22px] !w-[22px]" />
        <span className="text-[15px] text-[#33363d]">
          {MEMBER_CONSENT.tickbox}{" "}
          <button type="button" className="font-medium text-[color:var(--kb-ember)] underline underline-offset-4" onClick={(ev) => {
            ev.preventDefault();
            setDetailsOpen(true);
          }}>
            What this means
          </button>
        </span>
      </label>
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} title="How finding your photos works">
        <p className="m-0 text-[15px] leading-normal text-[color:var(--kb-ink-2)]">{MEMBER_CONSENT.lead}</p>
        <p className="m-0 text-[15px] leading-normal text-[color:var(--kb-ink-2)]">{MEMBER_CONSENT.what}</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal text-[color:var(--kb-ink-2)]">
          {MEMBER_CONSENT.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={() => setDetailsOpen(false)}>
            Got it
          </button>
        </div>
      </Dialog>

      {/* Two inputs: one opens the front camera, the other the photo
          library. A single input with `capture` gives phones no choice. */}
      <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
      <input ref={library} type="file" accept="image/*" className="hidden" onChange={pick} />
      <div className="flex flex-col gap-2.5">
        {selfie ? (
          <button type="button" className="btn btn-primary !min-h-[52px]" disabled={!consented || pending} onClick={submit}>
            {pending ? "Setting up…" : "Find my photos"}
          </button>
        ) : null}
        <button type="button" className={`btn ${selfie ? "btn-secondary" : "btn-primary"} !min-h-[52px]`} onClick={() => camera.current?.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {selfie ? "Take another" : "Take a selfie"}
        </button>
        <button type="button" className="btn btn-secondary !min-h-[52px]" onClick={() => library.current?.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-9 9" />
          </svg>
          Choose from your photos
        </button>
      </div>
      {!pending && selfie && !consented ? <p className="m-0 -mt-3 text-center text-[14px] text-[color:var(--kb-ink-3)]">Tick the box to continue.</p> : null}
      {message ? (
        <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]" role="status">
          {message}
        </p>
      ) : null}
      {/* It's optional, so leaving is a plain choice, not a hunt for the back button. */}
      {backHref ? (
        <Link href={backHref} className="-mt-2 flex min-h-[44px] items-center self-center text-[15px] font-medium">
          Not now, just browse the albums
        </Link>
      ) : null}
    </div>
  );
}

/** Withdrawing consent. Deliberately not buried: it is one click from the grid. */
export function TurnOff({ eventId }: { eventId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (message) return <p className="m-0 text-[14px] text-[color:var(--ink-70)]">{message}</p>;

  if (!confirming) {
    return (
      <button type="button" className="kb-link self-start !text-[15px] !font-medium !text-[#b42318]" onClick={() => setConfirming(true)}>
        Turn off face search and delete my face data
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[14px] text-[color:var(--ink-70)]">
        Deletes your selfie, your faceprint and every match. You can enrol again later.
      </span>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await withdrawFaceConsentAction(eventId);
            setMessage(res.error ?? res.message ?? "");
          })
        }
      >
        {pending ? "Deleting…" : "Delete it"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setConfirming(false)}
      >
        Keep it
      </button>
    </div>
  );
}

/** "Replace my selfie": opens the selfie screen again in place, under the grid. */
export function ReplaceSelfie({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <div className="pt-3"><Enrol eventId={eventId} /></div>;
  return (
    <button type="button" className="kb-link self-start !text-[15px] !font-medium" onClick={() => setOpen(true)}>
      Replace my selfie
    </button>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { enrolFaceAction, withdrawFaceConsentAction } from "@/app/(app)/face-actions";
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

export function Enrol({ clubId }: { clubId: string }) {
  const [consented, setConsented] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="soft-card flex max-w-[56ch] flex-col gap-3 p-5">
      <span className="soft-display text-[22px]">{MEMBER_CONSENT.title}</span>
      <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">{MEMBER_CONSENT.lead}</p>
      <p className="m-0 text-[15px] leading-normal text-[color:var(--kb-ink-2)]">{MEMBER_CONSENT.what}</p>
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal text-[color:var(--kb-ink-2)]">
        {MEMBER_CONSENT.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-[76px] w-[76px] flex-none items-center justify-center overflow-hidden rounded-full bg-[color:var(--tone-support)] text-[14px] font-bold text-[color:var(--tone-support-ink)]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img src={preview} alt="Your selfie" className="h-full w-full object-cover" />
          ) : (
            "Selfie"
          )}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const jpeg = await toJpeg(file);
            if (!jpeg) {
              setMessage("We could not read that photo. Try a different one.");
              return;
            }
            setSelfie(jpeg);
            setPreview(URL.createObjectURL(jpeg));
            setMessage("");
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()}>
          {selfie ? "Use a different photo" : "Take or choose a selfie"}
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-[15px]">
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
          className="mt-0.5"
        />
        <span>{MEMBER_CONSENT.tickbox}</span>
      </label>

      <button
        type="button"
        className="btn btn-primary self-start"
        disabled={!consented || !selfie || pending}
        onClick={() =>
          startTransition(async () => {
            if (!selfie) return;
            const res = await enrolFaceAction(clubId, selfie, consented);
            setMessage(res.error ?? res.message ?? "");
          })
        }
      >
        {pending ? "Setting up…" : "Find my photos"}
      </button>
      {message ? (
        <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Withdrawing consent. Deliberately not buried: it is one click from the grid. */
export function TurnOff({ clubId }: { clubId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (message) return <p className="m-0 text-[14px] text-[color:var(--ink-70)]">{message}</p>;

  if (!confirming) {
    return (
      <button
        type="button"
        className="kb-link kb-link-quiet"
        onClick={() => setConfirming(true)}
      >
        Turn this off and delete my faceprint
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
            const res = await withdrawFaceConsentAction(clubId);
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

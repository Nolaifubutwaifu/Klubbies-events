"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/app/(app)/admin/actions";
import { createGuestLinkAction, emailGuestLinkAction, type GuestLinkState } from "@/app/(app)/admin/guest-actions";

// Said in words, not with strikethrough: a struck-out line is hard to read
// and screen readers announce it as something the link can do.
const CAN = [
  { yes: true, text: "Can upload full resolution photos and videos into that album" },
  { yes: false, text: "Can't see other albums, attendees or anything else in the event" },
  { yes: false, text: "Can't delete or download what's already there" },
];

function Tick({ yes }: { yes: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      {yes ? <path d="M5 12.5l4.5 4.5L19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
  );
}

export function GuestLinkForm({
  eventId,
  handle,
  albums,
  defaultExpiry,
}: {
  eventId: string;
  handle: string;
  albums: { id: string; title: string; status: string }[];
  defaultExpiry: string;
}) {
  const [state, action] = useActionState<GuestLinkState, FormData>(createGuestLinkAction.bind(null, eventId), {});
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);
  const [mailTo, setMailTo] = useState("");
  const [mailed, setMailed] = useState<{ ok?: boolean; text: string } | null>(null);
  const [mailing, setMailing] = useState(false);

  // The link is shown once, so give every way to hand it over: copy, the
  // phone's share sheet, and a QR the photographer can scan off this screen.
  useEffect(() => {
    const url = state.url;
    if (!url) return;
    let live = true;
    void import("qrcode")
      .then((QRCode) => QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 }))
      .then((svg) => live && setQr({ url, svg }));
    return () => {
      live = false;
    };
  }, [state.url]);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="soft-card flex flex-col gap-4 p-5">
        <h2 className="text-[16px] font-semibold">Add a photographer</h2>

        {albums.length === 0 ? (
          <p className="m-0 flex flex-wrap items-center gap-3 text-[14px] text-[color:var(--ink-70)]">
            Each photographer link uploads into one album, so make one first.
            <Link href={`/admin/${handle}/upload`} className="btn btn-secondary btn-sm no-underline">
              New album
            </Link>
          </p>
        ) : (
          <>
            <label className="field">
              Photographer&apos;s name
              <input className="input" name="label" placeholder="Jane Citizen" required maxLength={120} />
              <span className="kb-help font-normal">Shown as the credit on every photo they upload.</span>
            </label>
            <label className="field">
              Uploads land in
              <select className="input" name="albumId" defaultValue={albums[0]?.id}>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                    {album.status === "draft" ? " (draft)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Link expires
              <input className="input" name="expiresOn" type="date" defaultValue={defaultExpiry} required />
            </label>

            <div className="rounded-[var(--kb-r-card)] bg-[color:var(--kb-cream)] p-4">
              <span className="block text-[14px] font-medium">What the link can do</span>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {CAN.map((row) => (
                  <li key={row.text} className="flex items-start gap-2 text-[14px]">
                    <span className="mt-0.5 flex-none" style={{ color: row.yes ? "#1f6b3a" : "#b42318" }}>
                      <Tick yes={row.yes} />
                    </span>
                    <span>{row.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <FormMessage state={state} />
            <SubmitButton className="btn btn-primary self-start" pendingText="Making the link…">
              Create upload link
            </SubmitButton>
          </>
        )}
      </form>

      {state.url ? (
        <div className="soft-card flex flex-col gap-3 !border-[color:var(--kb-ember)] p-5">
          <span className="text-[14px] font-medium">Copy this link now and send it to the photographer. It isn&apos;t shown again.</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="mono min-w-0 flex-1 break-all rounded-[8px] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] px-3 py-2.5 text-[14px]">
              {state.url}
            </code>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard.writeText(state.url ?? "");
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void navigator.share({ title: "Your upload link", url: state.url }).catch(() => undefined)}
              >
                Send
              </button>
            ) : null}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!state.url) return;
              setMailing(true);
              const res: ActionState = await emailGuestLinkAction(eventId, state.url, mailTo).catch(() => ({ error: "Couldn't send it. Copy the link instead." }));
              setMailed(res.error ? { text: res.error } : { ok: true, text: res.message ?? "Sent" });
              setMailing(false);
            }}
          >
            <label className="field min-w-[220px] flex-1">
              Or email it to the photographer
              <input className="input" type="email" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="name@example.com" required />
            </label>
            <button type="submit" className="btn btn-secondary" disabled={mailing}>
              {mailing ? "Sending…" : "Email the link"}
            </button>
            {mailed ? (
              <span className={mailed.ok ? "w-full text-[14px] text-[color:var(--kb-ink-2)]" : "kb-error w-full"} role="status">
                {mailed.text}
              </span>
            ) : null}
          </form>
          {qr?.url === state.url ? (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="block h-[132px] w-[132px] flex-none rounded-[8px] border border-[color:var(--kb-line)] bg-white [&>svg]:h-full [&>svg]:w-full"
                role="img"
                aria-label="QR code of the upload link"
                dangerouslySetInnerHTML={{ __html: qr.svg }}
              />
              <span className="max-w-[36ch] text-[14px] text-[color:var(--ink-70)]">
                Or let the photographer scan this with their phone camera.
              </span>
            </div>
          ) : null}
          <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
            Upload only. Revoke it any time. We store a fingerprint of the link, not the link itself, so it can&apos;t be
            shown again; make a new one if it gets lost.
          </p>
        </div>
      ) : null}
    </div>
  );
}

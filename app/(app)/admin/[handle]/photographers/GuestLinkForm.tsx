"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { createGuestLinkAction, type GuestLinkState } from "@/app/(app)/admin/guest-actions";

const CAN = [
  { yes: true, text: "Upload full resolution photos and videos into that album" },
  { yes: false, text: "See other albums, attendees or anything else in the event" },
  { yes: false, text: "Delete or download what's already there" },
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
  albums,
  defaultExpiry,
}: {
  eventId: string;
  albums: { id: string; title: string; status: string }[];
  defaultExpiry: string;
}) {
  const [state, action] = useActionState<GuestLinkState, FormData>(createGuestLinkAction.bind(null, eventId), {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="soft-card flex flex-col gap-4 p-5">
        <h2 className="text-[16px] font-semibold">Add a photographer</h2>

        {albums.length === 0 ? (
          <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
            Create an album first. Each photographer link uploads into one album.
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
                    <span style={row.yes ? undefined : { textDecoration: "line-through", opacity: 0.85 }}>{row.text}</span>
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
          </div>
          <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
            Upload only. Revoke it any time. We store a fingerprint of the link, not the link itself, so it can&apos;t be
            shown again; make a new one if it gets lost.
          </p>
        </div>
      ) : null}
    </div>
  );
}

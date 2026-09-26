"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { createGuestLinkAction, type GuestLinkState } from "@/app/(app)/admin/guest-actions";

const CAN = [
  { yes: true, text: "Upload photos and videos into that one album" },
  { yes: false, text: "See any album, member or anything else on the club" },
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
  clubId,
  albums,
  defaultExpiry,
}: {
  clubId: string;
  albums: { id: string; title: string; status: string }[];
  defaultExpiry: string;
}) {
  const [state, action] = useActionState<GuestLinkState, FormData>(createGuestLinkAction.bind(null, clubId), {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="soft-card flex flex-col gap-4 p-5">
        <h2 className="soft-display text-[19px]">New guest link</h2>

        {albums.length === 0 ? (
          <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
            Make an album first — a guest link always points at exactly one.
          </p>
        ) : (
          <>
            <label className="field">
              Who is it for?
              <input className="input" name="label" placeholder="Ruth Alvarez — End of Season Awards" required maxLength={120} />
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

            <div className="rounded-[var(--soft-r-sm)] bg-[color:var(--tone-support)] p-4 text-[color:var(--tone-support-ink)]">
              <span className="block text-[14px] font-bold">What they can do</span>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {CAN.map((row) => (
                  <li key={row.text} className="flex items-start gap-2 text-[14px]">
                    <span className="mt-0.5 flex-none" style={{ color: row.yes ? "#2f6b36" : "#8c1600" }}>
                      <Tick yes={row.yes} />
                    </span>
                    <span style={row.yes ? undefined : { textDecoration: "line-through", opacity: 0.85 }}>{row.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <FormMessage state={state} />
            <SubmitButton className="soft-btn soft-btn-primary self-start" pendingText="Making the link…">
              Generate link
            </SubmitButton>
          </>
        )}
      </form>

      {state.url ? (
        <div className="soft-card flex flex-col gap-3 border-2 border-accent p-5">
          <span className="text-[14px] font-bold text-accent-800">
            Your new link — copy it once, it&apos;s not shown again
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-full bg-[color:var(--color-bg)] px-4 py-2.5 text-[14px]">
              {state.url}
            </code>
            <button
              type="button"
              className="soft-btn soft-btn-tonal !min-h-[40px]"
              onClick={() => {
                void navigator.clipboard.writeText(state.url ?? "");
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
            Upload only. Revoke it any time below. We store a hash of the link, not the link, so we can&apos;t show it to
            you again.
          </p>
        </div>
      ) : null}
    </div>
  );
}

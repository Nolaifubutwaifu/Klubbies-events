"use client";

import { useState, useTransition } from "react";
import { notifyOnNewAlbumsAction } from "@/app/(app)/account/actions";

/**
 * A club that's on the list but has nothing on it yet. Two empty photo cards
 * lying where the first album will go, and one thing to press so the wait
 * isn't passive.
 */
export function EmptyClub({ clubName, alreadySubscribed }: { clubName: string; alreadySubscribed: boolean }) {
  const [done, setDone] = useState(alreadySubscribed);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 flex max-w-[460px] flex-col">
      <h2 className="text-[clamp(22px,5vw,25px)]">{clubName}</h2>
      <p className="mt-1 text-[14px] text-[color:var(--color-neutral-700)]">
        You&rsquo;re on the list. There&rsquo;s just nothing on it yet.
      </p>

      <div className="relative mt-7 h-[210px]" aria-hidden>
        <div
          className="absolute left-6 top-10 w-[150px] rounded-[18px] border border-dashed p-2.5"
          style={{ transform: "rotate(-9deg)", background: "var(--color-surface)", borderColor: "color-mix(in srgb, var(--color-text) 22%, transparent)" }}
        >
          <span className="block h-24 rounded-[12px]" style={{ background: "color-mix(in srgb, var(--color-text) 5%, var(--color-bg))" }} />
          <span className="mt-2 block h-[9px] w-[70%] rounded-full" style={{ background: "color-mix(in srgb, var(--color-text) 10%, transparent)" }} />
        </div>
        <div
          className="absolute right-6 top-3.5 w-[164px] rounded-[18px] border border-dashed p-2.5"
          style={{ transform: "rotate(7deg)", background: "var(--color-surface)", borderColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)" }}
        >
          <span
            className="flex h-[104px] items-center justify-center rounded-[12px]"
            style={{ background: "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))" }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="14" rx="3" />
              <circle cx="12" cy="13" r="3.4" />
              <path d="M8 6l1.6-2.4h4.8L16 6" />
            </svg>
          </span>
          <span className="mt-2 block h-[9px] w-[84%] rounded-full" style={{ background: "color-mix(in srgb, var(--color-accent) 18%, transparent)" }} />
        </div>
      </div>

      <h3 className="mt-3 text-[clamp(19px,4.5vw,21px)]">Nothing here yet. Your first event is about to be legendary.</h3>
      <p className="mt-2 text-[14px] text-[color:var(--color-neutral-700)]">
        When your committee drops an album, it lands here and we&rsquo;ll email you once.
      </p>

      {done ? (
        <p className="mt-5 flex items-center gap-2 text-[14px] font-bold text-[#2f6b36]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
          {message || "You'll get an email when it's shared."}
        </p>
      ) : (
        <button
          type="button"
          className="soft-btn soft-btn-primary mt-5 !min-h-[52px] !text-[16px]"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await notifyOnNewAlbumsAction();
              if (res.error) return setMessage(res.error);
              setMessage(res.message ?? "");
              setDone(true);
            })
          }
        >
          {pending ? "Setting that up…" : "Email me when photos land"}
        </button>
      )}
      {message && !done ? <p className="mt-2 text-[14px] text-accent-800">{message}</p> : null}

      <p className="mt-3.5 text-center text-[14px] text-[color:var(--ink-55)]">
        Got shots on your phone from Friday? Ask your committee to open uploads on an album.
      </p>
    </div>
  );
}

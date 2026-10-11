"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acknowledgeFaceNoticeAction } from "@/app/(app)/face-actions";
import { MEMBER_NOTICE } from "@/lib/faces/copy";

/**
 * Shown to every member of a event that has face recognition on, until they
 * acknowledge it once. Not a modal: the event's name and details stay readable
 * around it, but its albums open only once this is read, so "we told them
 * before they saw any photos" is true.
 *
 * This is disclosure, not consent. Consent is enrolment, and enrolment stays
 * optional: a member can acknowledge this and never enrol, and most will.
 */
export function FaceNotice({ eventId, meHref }: { eventId: string; meHref: string }) {
  const router = useRouter();
  const [acked, setAcked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (acked) return null;

  return (
    <section
      aria-labelledby="face-notice-title"
      className="overflow-hidden rounded-[12px] border border-[color:var(--kb-line)] bg-white shadow-[0_10px_28px_-12px_rgb(22_24_29/0.18)]"
    >
      <div className="flex items-center gap-3 bg-[color:var(--kb-ink)] px-[18px] py-4 text-white">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#2a2d35]" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
            <circle cx="12" cy="10" r="2.5" />
            <path d="M7.8 16.5c.8-1.8 2.3-2.7 4.2-2.7s3.4.9 4.2 2.7" />
          </svg>
        </span>
        <h2 id="face-notice-title" className="text-[17px] font-semibold leading-[1.3] !text-white">
          {MEMBER_NOTICE.title}
        </h2>
      </div>
      <div className="flex flex-col gap-3.5 px-[18px] pb-[18px] pt-4">
        <details open className="group">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-semibold text-[color:var(--kb-ember)] [&::-webkit-details-marker]:hidden">
            What this means
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden className="transition-transform group-open:rotate-180">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-2.5 pl-[18px] text-[15px] leading-normal text-[#33363d]">
            {MEMBER_NOTICE.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <a href={meHref} className="mt-1 inline-flex min-h-[44px] items-center font-medium">
            See what it would show me
          </a>
        </details>
        <button
          type="button"
          className="min-h-[52px] rounded-[8px] bg-[color:var(--kb-ink)] px-4 py-3 text-left text-[15px] font-semibold leading-[1.35] text-white disabled:opacity-60"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await acknowledgeFaceNoticeAction(eventId).catch(() => ({ error: "offline" }));
              // On a bad connection this used to just re-enable the button.
              if (res.error) setError("Couldn't save that. Check your connection and try again.");
              else {
                setAcked(true);
                // The albums behind the notice open now.
                router.refresh();
              }
            })
          }
        >
          {pending ? "Saving…" : MEMBER_NOTICE.tickbox}
        </button>
        {error ? (
          <p className="kb-error m-0" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

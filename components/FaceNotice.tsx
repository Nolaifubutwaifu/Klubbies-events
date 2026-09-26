"use client";

import { useState, useTransition } from "react";
import { acknowledgeFaceNoticeAction } from "@/app/(app)/face-actions";
import { MEMBER_NOTICE } from "@/lib/faces/copy";

/**
 * Shown to every member of a club that has face recognition on, until they
 * acknowledge it once. Not a modal and not a blocker — they can read the club
 * around it — but it does not go away on its own, because "we told them" has
 * to mean something more than a banner they scrolled past.
 *
 * This is disclosure, not consent. Consent is enrolment, and enrolment stays
 * optional: a member can acknowledge this and never enrol, and most will.
 */
export function FaceNotice({ clubId, meHref }: { clubId: string; meHref: string }) {
  const [acked, setAcked] = useState(false);
  const [pending, startTransition] = useTransition();
  if (acked) return null;

  return (
    <section aria-label="Face recognition notice" className="kb-info mx-4 mb-4 flex-col gap-3 sm:mx-6 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold">{MEMBER_NOTICE.title}</span>
        <details className="mt-1">
          <summary className="kb-link !min-h-[36px] cursor-pointer list-none">What this means</summary>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal text-[color:var(--kb-ink-2)]">
            {MEMBER_NOTICE.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <a href={meHref} className="kb-link">
            See what it would show me
          </a>
        </details>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm !whitespace-normal !text-left"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acknowledgeFaceNoticeAction(clubId);
            if (!res.error) setAcked(true);
          })
        }
      >
        {pending ? "Saving…" : MEMBER_NOTICE.tickbox}
      </button>
    </section>
  );
}

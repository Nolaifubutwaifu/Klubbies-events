"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptInviteAction, declineInviteAction } from "@/app/(app)/actions";
import type { MyClub } from "@/lib/auth/session";
import { MEMBER_NOTICE } from "@/lib/faces/copy";
import { formatLongDate } from "@/lib/format";

export function InviteCard({ invite }: { invite: MyClub }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Joining a club that analyses faces means yours is analysed too, enrolled
  // or not. That is said here, before the join, rather than discovered later:
  // this is the last moment the answer can still be "no thanks".
  const [understood, setUnderstood] = useState(false);
  const needsNotice = invite.facesEnabled;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-accent p-4">
      <span className="max-w-[42ch] text-[14px] leading-normal">
        <strong>{invite.name}</strong> added you to their member list on {formatLongDate(invite.since)}. Accept to see
        their albums.
      </span>
      {needsNotice ? (
        <div className="w-full">
          <span className="block text-[14px] font-bold">{MEMBER_NOTICE.title}</span>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5 text-[14px] leading-normal text-[color:var(--ink-70)]">
            {MEMBER_NOTICE.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="mt-0.5"
            />
            <span>{MEMBER_NOTICE.tickbox}</span>
          </label>
        </div>
      ) : null}
      <span className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary text-[14px]"
          disabled={pending || (needsNotice && !understood)}
          onClick={() =>
            startTransition(async () => {
              const res = await acceptInviteAction(invite.membershipId, needsNotice);
              if (res.ok) {
                router.push(`/c/${invite.handle}`);
                router.refresh();
              }
            })
          }
        >
          Accept
        </button>
        <button
          type="button"
          className="btn btn-ghost text-[14px]"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await declineInviteAction(invite.membershipId);
              router.refresh();
            })
          }
        >
          Not me
        </button>
      </span>
    </div>
  );
}

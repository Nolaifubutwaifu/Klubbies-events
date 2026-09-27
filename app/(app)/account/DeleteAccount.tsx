"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteAccountAction, type AccountResult } from "./actions";

type EventRef = { name: string; handle: string };

/**
 * Delete account, at the bottom of the profile. Closed until asked for, then
 * it says plainly what goes, what stays, and what happens to any event this
 * person runs alone, before the one red button.
 */
export function DeleteAccount({ handOver, closes }: { handOver: EventRef[]; closes: EventRef[] }) {
  const [open, setOpen] = useState(false);
  const [understand, setUnderstand] = useState(false);
  const [state, action, pending] = useActionState<AccountResult, FormData>(deleteAccountAction, {});

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-sm self-start" onClick={() => setOpen(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <div className="soft-card flex flex-col gap-3 p-5 text-[14px] leading-normal">
      <h2 className="text-[18px] font-semibold">Delete your account</h2>
      <p className="m-0">
        This deletes your sign-in, your profile and photo, your saved photos, and your face recognition selfie and
        faceprints. It can&apos;t be undone.
      </p>
      <p className="m-0 text-[color:var(--ink-70)]">
        Photos you uploaded stay with the event; ask the organiser if you want any taken down. If you joined through an
        event link, you leave that event&apos;s attendee list. If the organiser invited you from a guest list, your name
        stays on it and you can sign in again later.
      </p>

      {handOver.length > 0 ? (
        <div className="notice flex flex-col gap-2">
          <span>
            You&apos;re the only organiser of {handOver.map((event) => event.name).join(" and ")}. Make another attendee a
            co-organiser first, so the event isn&apos;t left without anyone running it.
          </span>
          {handOver.map((event) => (
            <Link key={event.handle} href={`/admin/${event.handle}/attendees`} className="kb-link">
              Add a co-organiser to {event.name}
            </Link>
          ))}
        </div>
      ) : (
        <>
          {closes.length > 0 ? (
            <div className="notice">
              Nobody else has joined {closes.map((event) => event.name).join(" or ")}, so it closes with your account and its
              photos are deleted.
            </div>
          ) : null}
          <form action={action} className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="understand" value="yes" checked={understand} onChange={(e) => setUnderstand(e.target.checked)} />
              <span>I understand my account is deleted for good.</span>
            </label>
            {state.error ? <span className="notice">{state.error}</span> : null}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-danger" disabled={!understand || pending}>
                {pending ? "Deleting…" : "Delete my account"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
                Keep my account
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

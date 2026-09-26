"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { joinEventAction } from "@/app/(app)/e/[handle]/actions";

/** Signed in, holding the link, not in the event yet. */
export function JoinEvent({ handle, mode, email }: { handle: string; mode: "link" | "guest_list"; email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (mode === "guest_list") {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
          This event is only open to its guest list, and <strong>{email}</strong> isn&apos;t on it. If you registered with
          a different address, sign out and use that one. Otherwise ask the organiser to add you.
        </p>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="btn btn-secondary">
            Sign out and use another email
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
        You&apos;re signed in as <strong>{email}</strong>. Join to see the photos and find the ones you&apos;re in.
      </p>
      {error ? (
        <p className="kb-error m-0" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await joinEventAction(handle);
              if (result?.error) setError(result.error);
            })
          }
        >
          {pending ? "Joining…" : "Join event"}
        </button>
        <Link href="/events" className="btn btn-secondary no-underline">
          Not now
        </Link>
      </div>
    </div>
  );
}

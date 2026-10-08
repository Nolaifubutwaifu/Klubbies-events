"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

/** Keeps the organiser inside their event when one page fails, with a way to try again. */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { handle } = useParams<{ handle: string }>();
  return (
    <div className="flex max-w-[520px] flex-col gap-3 py-10">
      <span className="kb-eyebrow">Something went wrong</span>
      <h1 className="text-[26px] font-semibold">This page didn&apos;t load.</h1>
      <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
        Nothing you saved is lost. Try again, and if it keeps happening, come back in a few minutes.
      </p>
      {error.digest ? <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Try again
        </button>
        <Link href={`/admin/${handle}`} className="btn btn-secondary no-underline">
          Event overview
        </Link>
      </div>
    </div>
  );
}

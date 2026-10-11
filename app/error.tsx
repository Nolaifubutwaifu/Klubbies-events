"use client";

import Link from "next/link";
import { NoticePage } from "@/components/NoticePage";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <NoticePage
      badge="warn"
      eyebrow="Something went wrong"
      eyebrowTone="warn"
      title="That didn't load."
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/support#contact" className="btn btn-secondary no-underline">
            Contact us
          </Link>
        </>
      }
    >
      <p>It&apos;s on our side, and we&apos;ve been told. Try again in a moment.</p>
      {error.digest ? <p className="text-[14px] text-[color:var(--kb-ink-3)]">Reference: {error.digest}</p> : null}
    </NoticePage>
  );
}

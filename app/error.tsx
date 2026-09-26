"use client";

import Link from "next/link";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="theme-soft flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/" className="brand">
        klubbies
      </Link>
      <div className="flex max-w-[520px] flex-col gap-3 py-12">
        <span className="kicker">Something went wrong</span>
        <h1 className="display text-[40px]">That didn&apos;t load.</h1>
        <p className="text-[15px] text-ink-70">
          We&apos;ve been notified. Try again, and if it keeps happening, come back in a few minutes.
        </p>
        {error.digest ? <p className="text-[14px] text-ink-55">Reference: {error.digest}</p> : null}
        <div className="flex gap-3 pt-2">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/clubs" className="btn btn-secondary">
            My clubs
          </Link>
        </div>
      </div>
    </main>
  );
}

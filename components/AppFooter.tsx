"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Closes off the page so content doesn't fade into empty background. */
export function AppFooter() {
  // The lightbox covers the window; a footer underneath it only catches
  // clicks meant for the photo's own buttons.
  if (/^\/c\/[^/]+\/a\/[^/]+\/[^/]+/.test(usePathname())) return null;

  return (
    <footer className="app-footer relative z-10 mt-auto">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-[14px] text-[color:var(--ink-55)] sm:px-6">
        <span className="soft-wordmark text-[17px] text-ink">klubbies</span>
        <span>Your club&rsquo;s photos, for your club only.</span>
        <span className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
          <Link href="/how-it-works" className="text-[color:var(--ink-55)] no-underline hover:text-accent">
            How it works
          </Link>
          <Link href="/privacy" className="text-[color:var(--ink-55)] no-underline hover:text-accent">
            Privacy
          </Link>
          <Link href="/terms" className="text-[color:var(--ink-55)] no-underline hover:text-accent">
            Terms
          </Link>
          <Link href="/refunds" className="text-[color:var(--ink-55)] no-underline hover:text-accent">
            Refunds
          </Link>
        </span>
      </div>
    </footer>
  );
}

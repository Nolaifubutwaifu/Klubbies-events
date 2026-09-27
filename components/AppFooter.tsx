"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Closes off the page so content doesn't fade into empty background. */
export function AppFooter() {
  // The lightbox covers the window; a footer underneath it only catches
  // clicks meant for the photo's own buttons.
  if (/^\/e\/[^/]+\/a\/[^/]+\/[^/]+/.test(usePathname())) return null;

  return (
    <footer className="app-footer relative z-10 mt-auto border-t border-[color:var(--kb-line)]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-[14px] text-[color:var(--ink-55)] sm:px-6">
        <span>Klubbies Events · Private event photos</span>
        <span className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
          <Link href="/privacy" className="text-[color:var(--ink-55)] no-underline hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="text-[color:var(--ink-55)] no-underline hover:text-ink">
            Terms
          </Link>
          <Link href="/refunds" className="text-[color:var(--ink-55)] no-underline hover:text-ink">
            Refunds
          </Link>
          <Link href="/support" className="text-[color:var(--ink-55)] no-underline hover:text-ink">
            Support
          </Link>
        </span>
      </div>
    </footer>
  );
}

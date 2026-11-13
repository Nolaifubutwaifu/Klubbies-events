"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/refunds", "Refunds"],
  ["/support", "Support"],
] as const;

/**
 * The footer's one row. `width` is the column of the page above it, so the
 * footer sits on the same left and right edges as the content.
 */
export function FooterRow({ width = "wide" }: { width?: "wide" | "gallery" }) {
  return (
    <div
      className={`mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-2 py-6 text-[14px] text-[color:var(--ink-55)] ${
        width === "gallery" ? "max-w-[1200px] px-5 sm:px-10" : "max-w-[1320px] px-4 sm:px-6"
      }`}
    >
      <span>Klubbies Events · Private event photos</span>
      <span className="flex flex-wrap gap-x-4 gap-y-2 sm:ml-auto">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="text-[color:var(--ink-55)] no-underline hover:text-ink">
            {label}
          </Link>
        ))}
      </span>
    </div>
  );
}

/** Closes off the page so content doesn't fade into empty background. */
export function AppFooter() {
  const pathname = usePathname();
  // The lightbox covers the window; a footer underneath it only catches
  // clicks meant for the photo's own buttons.
  if (/^\/e\/[^/]+\/a\/[^/]+\/[^/]+/.test(pathname)) return null;
  // An event's organiser screens draw their own, inside the content column
  // beside the rail (app/(app)/admin/[handle]/layout.tsx).
  if (/^\/admin\/(?!new(\/|$))[^/]+/.test(pathname)) return null;

  return (
    <footer className="app-footer relative z-10 mt-auto border-t border-[color:var(--kb-line)]">
      <FooterRow width={/^\/(e\/|account|events)/.test(pathname) ? "gallery" : "wide"} />
    </footer>
  );
}

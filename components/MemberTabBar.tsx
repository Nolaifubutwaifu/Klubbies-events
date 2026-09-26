"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Most members open Klubbies on a phone at 11pm. Four destinations, thumb
 * height, always there — the design's tab bar, hidden once there's room for
 * the header nav instead. A fifth, Photos of you, joins them in a club where
 * the feature is on for this member: the rail was its only way in, and the
 * rail doesn't exist on a phone.
 */
export function MemberTabBar({ handle, photosOfYou = false }: { handle: string; photosOfYou?: boolean }) {
  const pathname = usePathname();
  const base = `/c/${handle}`;
  // The lightbox is full-bleed and carries its own actions; a tab bar over the
  // photo would be two rows of buttons arguing with each other.
  const inLightbox = new RegExp(`^/c/[^/]+/a/[^/]+/[^/]+`).test(pathname);

  const tabs: { href: string; label: string; icon: ReactNode; filled?: boolean; match: (p: string) => boolean }[] = [
    {
      href: base,
      label: "Home",
      match: (p) => p === base,
      icon: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
    },
    ...(photosOfYou
      ? [
          {
            href: `${base}/me`,
            label: "Photos of you",
            match: (p: string) => p.startsWith(`${base}/me`),
            icon: (
              <>
                <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
                <circle cx="12" cy="10" r="3" />
                <path d="M6.8 20.5c.9-2.9 2.8-4.3 5.2-4.3s4.3 1.4 5.2 4.3" />
              </>
            ),
          },
        ]
      : []),
    {
      href: `${base}/feed`,
      label: "Club feed",
      match: (p) => p.startsWith(`${base}/feed`),
      icon: (
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M7 9h10M7 13h6" />
        </>
      ),
    },
    {
      href: `${base}/saved`,
      label: "Saved",
      match: (p) => p.startsWith(`${base}/saved`),
      filled: true,
      icon: <path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />,
    },
    {
      href: "/account",
      label: "You",
      match: (p) => p.startsWith("/account"),
      icon: (
        <>
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M5 20c0-3.7 3.1-6 7-6s7 2.3 7 6" />
        </>
      ),
    },
  ];

  if (inLightbox) return null;

  return (
    <>
      <nav
        data-tabbar
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] bg-[color:var(--color-surface)] px-2.5 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 sm:hidden"
      >
        {tabs.map((tab) => {
          const here = tab.match(pathname);
          const colour = here ? "var(--color-accent-700)" : "var(--color-neutral-700)";
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={here ? "page" : undefined}
              className="flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] text-center text-[14px] font-bold leading-[1.15] no-underline"
              style={{ color: colour }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={here && tab.filled ? colour : "none"}
                stroke={colour}
                strokeWidth={here && tab.filled ? 1.6 : 2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {/* The footer after the page takes the bar's height as padding (see
          .app-footer in globals.css). A spacer here sat above the footer,
          which left the legal links under the bar. */}
    </>
  );
}

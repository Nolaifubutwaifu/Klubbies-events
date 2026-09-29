"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Most attendees open the gallery on a phone, often straight from the QR on
 * the night. Four destinations at thumb height, hidden once the header has
 * room for them. "Your photos" is only there where face recognition is on.
 */
export function MemberTabBar({ handle, facesEnabled = false }: { handle: string; facesEnabled?: boolean }) {
  const pathname = usePathname();
  const base = `/e/${handle}`;
  // The lightbox is full-bleed and carries its own actions.
  const inLightbox = /^\/e\/[^/]+\/a\/[^/]+\/[^/]+/.test(pathname);

  const tabs: { href: string; label: string; icon: ReactNode; match: (p: string) => boolean }[] = [
    {
      href: base,
      label: "Photos",
      match: (p) => p === base || p.startsWith(`${base}/a/`),
      icon: (
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M3.5 15.5l4.5-4 4 3.5 3-2.5 5.5 4.5" />
          <circle cx="15.5" cy="9" r="1.6" />
        </>
      ),
    },
    ...(facesEnabled
      ? [
          {
            href: `${base}/me`,
            label: "Your photos",
            match: (p: string) => p.startsWith(`${base}/me`),
            icon: (
              <>
                <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
                <circle cx="12" cy="10.5" r="2.6" />
                <path d="M7.8 16.5c.8-1.8 2.3-2.7 4.2-2.7s3.4.9 4.2 2.7" />
              </>
            ),
          },
        ]
      : []),
    {
      href: `${base}/saved`,
      label: "Saved",
      match: (p) => p.startsWith(`${base}/saved`),
      icon: <path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />,
    },
    {
      // Carries the event along, so this bar looks the same on the profile.
      href: `/account?event=${encodeURIComponent(handle)}`,
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
    <nav
      data-tabbar
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[color:var(--kb-line)] bg-[color:var(--kb-white)] px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
    >
      {tabs.map((tab) => {
        const here = tab.match(pathname);
        const colour = here ? "var(--kb-ink)" : "var(--kb-ink-3)";
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={here ? "page" : undefined}
            className="flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] text-center text-[14px] font-medium leading-[1.15] no-underline"
            style={{ color: colour }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={here ? "var(--kb-ember)" : colour} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {tab.icon}
            </svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

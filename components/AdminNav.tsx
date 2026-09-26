"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClubMark } from "@/components/ClubMark";

export type AdminNavCounts = {
  albums: number;
  members: number;
  removals: number;
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      </>
    ),
    albums: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3 15l4.5-4 4 3.5L15 10l6 5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 20V8M7 13l5-5 5 5" />
        <path d="M5 4h14" />
      </>
    ),
    members: (
      <>
        <circle cx="9" cy="8.5" r="3.4" />
        <path d="M3 20c0-3.5 2.7-5.6 6-5.6s6 2.1 6 5.6" />
        <path d="M16 5.4a3.4 3.4 0 0 1 0 6.3M17.5 14.7c2 .8 3.5 2.6 3.5 5.3" />
      </>
    ),
    guests: (
      <>
        <path d="M10.5 13.5a4.6 4.6 0 1 0 0-6.5l-5 5a4.6 4.6 0 0 0 6.5 6.5l1.2-1.2" />
        <path d="M13.5 10.5a4.6 4.6 0 1 0 0 6.5" />
      </>
    ),
    handover: (
      <>
        <path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5" />
        <path d="M20 16H7M10.5 12.5 7 16l3.5 3.5" />
      </>
    ),
    billing: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" />
      </>
    ),
    removals: (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 10v4M12 17.2v.1" />
      </>
    ),
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

/**
 * The committee's spine. A rail on desktop — the design puts the whole club in
 * one glance — and a scrolling row of the same links on a phone.
 */
export function AdminNav({
  handle,
  clubName,
  clubAddress,
  accentColour,
  logoUrl,
  counts,
  plan,
  person,
}: {
  handle: string;
  clubName: string;
  /** The shareable address without its scheme, from APP_URL — the same
      value Settings shows, so admins never copy two different links. */
  clubAddress: string;
  accentColour: string | null;
  logoUrl: string | null;
  counts: AdminNavCounts;
  plan: { line: string; hint: string };
  person: { name: string; role: string };
}) {
  const pathname = usePathname();
  const base = `/admin/${handle}`;

  const links = [
    { href: base, label: "Dashboard", icon: "dashboard", exact: true, badge: 0 },
    { href: `${base}/albums`, label: "Albums", icon: "albums", badge: counts.albums },
    { href: `${base}/upload`, label: "Upload", icon: "upload", badge: 0 },
    { href: `${base}/members`, label: "Members", icon: "members", badge: counts.members },
    { href: `${base}/guests`, label: "Guest links", icon: "guests", badge: 0 },
    ...(counts.removals > 0
      ? [{ href: `${base}/removals`, label: "Removals", icon: "removals", badge: counts.removals, urgent: true }]
      : []),
    { href: `${base}/roles`, label: "Handover", icon: "handover", badge: 0 },
    { href: `${base}/settings`, label: "Billing & settings", icon: "billing", badge: 0 },
  ];

  return (
    <nav aria-label="Committee" className="lg:sticky lg:top-5 lg:self-start">
      <div className="soft-card flex flex-col gap-1 p-3 lg:w-[248px]">
        <div className="hidden items-center gap-2.5 px-1.5 pb-3 lg:flex">
          <ClubMark name={clubName} logoUrl={logoUrl} accentColour={accentColour} size={36} />
          <span className="min-w-0">
            <span className="soft-display block truncate text-[15px]">{clubName}</span>
            <span className="block truncate text-[14px] text-[color:var(--ink-55)]">{clubAddress}</span>
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[44px] flex-none items-center gap-2.5 rounded-full px-3.5 text-[14px] font-bold no-underline transition-colors lg:flex-auto"
                style={{
                  background: active ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
                  color: active ? "var(--color-accent-700)" : "var(--color-text)",
                }}
              >
                <Icon name={link.icon} />
                <span className="whitespace-nowrap">{link.label}</span>
                {link.badge > 0 ? (
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[14px] font-extrabold"
                    style={
                      "urgent" in link && link.urgent
                        ? { background: "var(--color-accent)", color: "#fff" }
                        : { background: "color-mix(in srgb, var(--color-text) 7%, transparent)", color: "var(--color-neutral-700)" }
                    }
                  >
                    {link.badge.toLocaleString("en-AU")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 hidden flex-col gap-2 lg:flex">
          <Link
            href={`${base}/billing`}
            className="rounded-[var(--soft-r-sm)] bg-[color:var(--tone-support)] px-3.5 py-2.5 text-[color:var(--tone-support-ink)] no-underline"
          >
            <span className="block text-[14px] font-bold">{plan.line}</span>
            <span className="block text-[14px]">{plan.hint}</span>
          </Link>
          <div className="flex items-center gap-2.5 px-1.5 pt-1">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[color:var(--tone-support)] text-[14px] font-extrabold text-[color:var(--tone-support-ink)]">
              {person.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold">{person.name}</span>
              <span className="block truncate text-[14px] text-[color:var(--ink-55)]">{person.role}</span>
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

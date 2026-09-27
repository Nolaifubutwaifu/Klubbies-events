"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { EventMark } from "@/components/EventMark";

export type AdminNavCounts = {
  albums: number;
  attendees: number;
  photographers: number;
  removals: number;
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    albums: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 15l4.5-4 4 3.5L15 10l6 5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 20V8M7 13l5-5 5 5" />
        <path d="M5 4h14" />
      </>
    ),
    photographers: (
      <>
        <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    attendees: (
      <>
        <circle cx="9" cy="8.5" r="3.4" />
        <path d="M3 20c0-3.5 2.7-5.6 6-5.6s6 2.1 6 5.6" />
        <path d="M16 5.4a3.4 3.4 0 0 1 0 6.3M17.5 14.7c2 .8 3.5 2.6 3.5 5.3" />
      </>
    ),
    share: (
      <>
        <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
        <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
        <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
        <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
      </>
    ),
    removals: (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 10v4M12 17.2v.1" />
      </>
    ),
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
      </>
    ),
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

/**
 * The organiser's spine. A rail on desktop, a scrolling row of the same links
 * on a phone.
 */
export function AdminNav({
  handle,
  eventName,
  eventAddress,
  accentColour,
  logoUrl,
  status,
  counts,
  plan,
}: {
  handle: string;
  eventName: string;
  /** The shareable address without its scheme, from APP_URL. */
  eventAddress: string;
  accentColour: string | null;
  logoUrl: string | null;
  status: { label: string; tone: "live" | "quiet" | "attention" };
  counts: AdminNavCounts;
  plan: { line: string; hint: string };
}) {
  const pathname = usePathname();
  const base = `/admin/${handle}`;
  const row = useRef<HTMLDivElement>(null);

  // On a phone the links are one scrolling row; keep the current one in view.
  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && row.current && row.current.scrollWidth > row.current.clientWidth) {
      row.current.scrollTo({ left: current.offsetLeft - 16, behavior: "instant" });
    }
  }, [pathname]);

  const links = [
    { href: base, label: "Overview", icon: "overview", exact: true, badge: 0 },
    { href: `${base}/albums`, label: "Albums", icon: "albums", badge: counts.albums },
    { href: `${base}/upload`, label: "Upload", icon: "upload", badge: 0 },
    { href: `${base}/photographers`, label: "Photographers", icon: "photographers", badge: counts.photographers },
    { href: `${base}/attendees`, label: "Attendees", icon: "attendees", badge: counts.attendees },
    { href: `${base}/share`, label: "Share", icon: "share", badge: 0 },
    ...(counts.removals > 0
      ? [{ href: `${base}/removals`, label: "Removals", icon: "removals", badge: counts.removals, urgent: true }]
      : []),
    { href: `${base}/activity`, label: "Activity", icon: "activity", badge: 0 },
    { href: `${base}/settings`, label: "Settings", icon: "settings", badge: 0 },
  ];

  const toneStyle =
    status.tone === "live"
      ? { background: "#e8f5ec", color: "#1f6b3a" }
      : status.tone === "attention"
        ? { background: "#fef3f2", color: "#b42318" }
        : { background: "var(--kb-sand)", color: "var(--kb-ink-2)" };

  return (
    <nav aria-label="Organiser" className="lg:sticky lg:top-4 lg:self-start">
      <div className="flex flex-col gap-1 lg:w-[232px]">
        <div className="hidden flex-col gap-2 px-2 pb-4 pt-1 lg:flex">
          <div className="flex items-center gap-2.5">
            <EventMark name={eventName} logoUrl={logoUrl} accentColour={accentColour} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{eventName}</span>
              <span className="block truncate text-[14px] text-[color:var(--ink-55)]">{eventAddress}</span>
            </span>
          </div>
          <span className="w-fit rounded-[6px] px-2 py-0.5 text-[14px] font-medium" style={toneStyle}>
            {status.label}
          </span>
        </div>

        <div ref={row} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[44px] flex-none items-center gap-2.5 rounded-[8px] px-3 text-[14px] lg:min-h-[40px] font-medium no-underline transition-colors lg:flex-auto"
                style={{
                  background: active ? "var(--kb-white)" : "transparent",
                  boxShadow: active ? "inset 0 0 0 1px var(--kb-line)" : undefined,
                  color: active ? "var(--kb-ink)" : "var(--kb-ink-2)",
                }}
              >
                <span style={{ color: active ? "var(--kb-ember)" : "var(--kb-ink-3)" }}>
                  <Icon name={link.icon} />
                </span>
                <span className="whitespace-nowrap">{link.label}</span>
                {link.badge > 0 ? (
                  <span
                    className="ml-auto rounded-[6px] px-1.5 py-px text-[14px] font-medium tabular-nums"
                    style={
                      "urgent" in link && link.urgent
                        ? { background: "#b42318", color: "#fff" }
                        : { background: "var(--kb-sand)", color: "var(--kb-ink-2)" }
                    }
                  >
                    {link.badge.toLocaleString("en-AU")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <Link
          href={`${base}/billing`}
          className="mt-4 hidden rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-white)] px-3.5 py-3 text-ink no-underline lg:block"
        >
          <span className="block text-[14px] font-medium">{plan.line}</span>
          <span className="block text-[14px] text-[color:var(--kb-ink-3)]">{plan.hint}</span>
        </Link>
      </div>
    </nav>
  );
}

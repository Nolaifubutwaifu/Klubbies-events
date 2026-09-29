"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
    plan: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
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

type NavLink = { href: string; label: string; icon: string; exact?: boolean; badge: number; urgent?: boolean };

/**
 * The organiser's spine, grouped so it can be scanned: Overview, then Photos,
 * People and Event. A rail on desktop; on a phone one Menu button naming the
 * current screen, which opens the same grouped list. Hidden entirely while
 * the event's required setup steps are unfinished (the layout decides).
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
  next,
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
  /** The next recommended setup step, if any are left. */
  next: { title: string; href: string; done: number; total: number } | null;
}) {
  const pathname = usePathname();
  const base = `/admin/${handle}`;
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const groups: { title: string | null; links: NavLink[] }[] = [
    { title: null, links: [{ href: base, label: "Overview", icon: "overview", exact: true, badge: 0 }] },
    {
      title: "Photos",
      links: [
        { href: `${base}/albums`, label: "Albums", icon: "albums", badge: counts.albums },
        { href: `${base}/upload`, label: "Upload", icon: "upload", badge: 0 },
        { href: `${base}/photographers`, label: "Photographers", icon: "photographers", badge: counts.photographers },
      ],
    },
    {
      title: "People",
      links: [
        { href: `${base}/attendees`, label: "Attendees", icon: "attendees", badge: counts.attendees },
        { href: `${base}/share`, label: "Invite and share", icon: "share", badge: 0 },
        ...(counts.removals > 0
          ? [{ href: `${base}/removals`, label: "Removal requests", icon: "removals", badge: counts.removals, urgent: true }]
          : []),
      ],
    },
    {
      title: "Event",
      links: [
        { href: `${base}/settings`, label: "Settings", icon: "settings", badge: 0 },
        { href: `${base}/billing`, label: "Plan", icon: "plan", badge: 0 },
        { href: `${base}/activity`, label: "Activity", icon: "activity", badge: 0 },
      ],
    },
  ];
  const isActive = (link: NavLink) => (link.exact ? pathname === link.href : pathname.startsWith(link.href));
  const current = groups.flatMap((g) => g.links).find(isActive);
  const urgentCount = counts.removals;

  const toneStyle =
    status.tone === "live"
      ? { background: "var(--kb-ok-tint)", color: "var(--kb-ok)" }
      : status.tone === "attention"
        ? { background: "var(--kb-warn-tint)", color: "var(--kb-warn)" }
        : { background: "var(--kb-sand)", color: "var(--kb-ink-2)" };

  const list = (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.title ?? "top"} className="flex flex-col gap-0.5">
          {group.title ? <span className="px-3 pb-1 text-[14px] font-medium text-[color:var(--kb-ink-3)]">{group.title}</span> : null}
          {group.links.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[44px] items-center gap-2.5 rounded-[8px] px-3 text-[15px] font-medium no-underline transition-colors lg:min-h-[40px] lg:text-[14px]"
                style={{
                  background: active ? "var(--kb-brand-tint)" : "transparent",
                  color: active ? "var(--kb-brand-deep)" : "var(--kb-ink-2)",
                }}
              >
                <span style={{ color: active ? "var(--kb-brand)" : "var(--kb-ink-3)" }}>
                  <Icon name={link.icon} />
                </span>
                <span className="whitespace-nowrap">{link.label}</span>
                {link.badge > 0 ? (
                  <span
                    className="ml-auto rounded-[6px] px-1.5 py-px text-[14px] font-medium tabular-nums"
                    style={link.urgent ? { background: "var(--kb-warn)", color: "#fff" } : { background: "var(--kb-sand)", color: "var(--kb-ink-2)" }}
                  >
                    {link.badge.toLocaleString("en-AU")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <nav aria-label="Organiser" className="lg:sticky lg:top-4 lg:self-start">
      {/* Phone: one button that says where you are. */}
      <div className="lg:hidden">
        <button
          type="button"
          className="flex min-h-[48px] w-full items-center gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-white)] px-3.5 text-left"
          aria-expanded={open}
          aria-controls="organiser-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span style={{ color: "var(--kb-brand)" }}>
            <Icon name={current?.icon ?? "overview"} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] text-[color:var(--kb-ink-3)]">Menu</span>
            <span className="block truncate text-[15px] font-semibold">{current?.label ?? "Overview"}</span>
          </span>
          {urgentCount > 0 && !open ? (
            <span className="rounded-[6px] px-1.5 py-px text-[14px] font-medium" style={{ background: "var(--kb-warn)", color: "#fff" }}>
              {urgentCount}
            </span>
          ) : null}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={open ? "rotate-180" : ""}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open ? (
          <div
            ref={panel}
            id="organiser-menu"
            // Choosing a screen closes the menu.
            onClick={(ev) => (ev.target as HTMLElement).closest("a") && setOpen(false)}
            className="mt-2 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-white)] p-2 shadow-[var(--soft-shadow-lift)]"
          >
            {list}
          </div>
        ) : null}
      </div>

      {/* Desktop: the rail. */}
      <div className="hidden flex-col gap-1 lg:flex lg:w-[232px]">
        <div className="flex flex-col gap-2 px-2 pb-4 pt-1">
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

        {list}

        {next ? (
          <Link
            href={`${base}/setup`}
            className="mt-4 block rounded-[var(--kb-r-card)] border border-[#cdd7f7] bg-[color:var(--kb-brand-tint)] px-3.5 py-3 text-ink no-underline"
          >
            <span className="block text-[14px] font-medium text-[color:var(--kb-brand-deep)]">
              Setup {next.done} of {next.total}
            </span>
            <span className="block text-[14px] text-[color:var(--kb-ink-2)]">Next: {next.title}</span>
          </Link>
        ) : (
          <Link
            href={`${base}/billing`}
            className="mt-4 block rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-white)] px-3.5 py-3 text-ink no-underline"
          >
            <span className="block text-[14px] font-medium">{plan.line}</span>
            <span className="block text-[14px] text-[color:var(--kb-ink-3)]">{plan.hint}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

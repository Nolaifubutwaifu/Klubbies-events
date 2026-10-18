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

type NavLink = { href: string; label: string; icon: string; exact?: boolean; badge: number; urgent?: boolean; aside?: string };
type Group = { title: string | null; links: NavLink[] };

function navGroups(base: string, counts: AdminNavCounts, planShort: string): Group[] {
  return [
    { title: null, links: [{ href: base, label: "Overview", icon: "overview", exact: true, badge: 0 }] },
    {
      title: "Photos",
      links: [
        { href: `${base}/albums`, label: "Albums", icon: "albums", badge: 0 },
        { href: `${base}/upload`, label: "Upload", icon: "upload", badge: 0 },
        { href: `${base}/photographers`, label: "Photographers", icon: "photographers", badge: 0 },
      ],
    },
    {
      title: "People",
      links: [
        { href: `${base}/attendees`, label: "Attendees", icon: "attendees", badge: 0 },
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
        { href: `${base}/billing`, label: "Plan", icon: "plan", badge: 0, aside: planShort },
        { href: `${base}/activity`, label: "Activity", icon: "activity", badge: 0 },
      ],
    },
  ];
}

function useCurrent(groups: Group[]) {
  const pathname = usePathname();
  const isActive = (link: NavLink) => (link.exact ? pathname === link.href : pathname.startsWith(link.href));
  return { isActive, current: groups.flatMap((g) => g.links).find(isActive) };
}

function NavList({ groups, isActive, onPick }: { groups: Group[]; isActive: (link: NavLink) => boolean; onPick?: () => void }) {
  return (
    <div className="flex flex-col" onClick={(ev) => onPick && (ev.target as HTMLElement).closest("a") && onPick()}>
      {groups.map((group) => (
        <div key={group.title ?? "top"} className="flex flex-col">
          {group.title ? <span className="px-3 pb-1.5 pt-4 text-[14px] font-semibold text-[color:var(--kb-ink-3)]">{group.title}</span> : null}
          {group.links.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 text-[15px] font-medium no-underline transition-colors ${
                  active
                    ? "bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]"
                    : link.urgent
                      ? "text-[color:var(--kb-warn)] hover:bg-[#f2f2ef]"
                      : "text-[#33363d] hover:bg-[#f2f2ef] hover:text-[color:var(--kb-ink)]"
                }`}
              >
                <span className={active ? "text-[color:var(--kb-brand)]" : link.urgent ? "" : "text-[color:var(--kb-ink-3)]"}>
                  <Icon name={link.icon} />
                </span>
                <span className="whitespace-nowrap">{link.label}</span>
                {link.badge > 0 ? (
                  <span className="mono ml-auto rounded-full bg-[color:var(--kb-warn-tint)] px-2 text-[14px] text-[color:var(--kb-warn)]">
                    {link.badge.toLocaleString("en-AU")}
                  </span>
                ) : link.aside ? (
                  <span className="ml-auto text-[14px] text-[color:var(--kb-ink-3)]">{link.aside}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

type Shared = {
  handle: string;
  counts: AdminNavCounts;
  plan: { line: string; hint: string; short: string };
};

/**
 * The organiser's spine on a wide screen: a full-height white rail with the
 * event at the top, Overview, then Photos, People and Event, and the setup
 * progress and you at the foot. Hidden entirely while the event's required
 * setup steps are unfinished (the layout decides).
 */
export function AdminRail({
  handle,
  eventName,
  accentColour,
  logoUrl,
  status,
  counts,
  plan,
  next,
  switcher,
  account,
}: Shared & {
  eventName: string;
  accentColour: string | null;
  logoUrl: string | null;
  status: { label: string; tone: "live" | "quiet" | "attention" };
  /** The next recommended setup step, if any are left. */
  next: { title: string; href: string; done: number; total: number } | null;
  /** The event switcher, rendered on the server. */
  switcher: ReactNode;
  /** You, at the foot. */
  account: { node: ReactNode; name: string };
}) {
  const base = `/admin/${handle}`;
  const groups = navGroups(base, counts, plan.short);
  const { isActive } = useCurrent(groups);
  const statusColour = status.tone === "live" ? "var(--kb-ok)" : status.tone === "attention" ? "var(--kb-warn)" : "var(--kb-ink-3)";

  return (
    <aside
      aria-label="Organiser"
      className="sticky top-0 hidden h-dvh w-[256px] flex-none flex-col overflow-y-auto border-r border-[color:var(--kb-line)] bg-white px-3 py-4 lg:flex"
    >
      {/* The anchor for the event switcher's list, so it opens right here. */}
      <div className="relative flex items-center gap-3 border-b border-[color:var(--kb-sand)] px-2 pb-4 pt-1">
        <EventMark name={eventName} logoUrl={logoUrl} accentColour={accentColour} size={40} />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <span className="truncate text-[15px] font-semibold">{eventName}</span>
          <span className="flex items-center gap-1.5 text-[14px]" style={{ color: statusColour }}>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: statusColour }} aria-hidden />
            <span className="truncate">{status.label}</span>
          </span>
        </span>
        {switcher}
      </div>

      <nav aria-label="Organiser" className="pt-3">
        <NavList groups={groups} isActive={isActive} />
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        {next ? (
          <Link
            href={`${base}/setup`}
            className="flex flex-col gap-2 rounded-[10px] border border-[color:var(--kb-sand)] bg-[color:var(--kb-cream)] p-3.5 text-ink no-underline"
          >
            <span className="flex justify-between text-[14px]">
              <span className="font-semibold">
                Setup {next.done} of {next.total}
              </span>
              <span className="mono text-[color:var(--kb-ink-3)]">{Math.round((next.done / next.total) * 100)}%</span>
            </span>
            <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-[color:var(--kb-line)]" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-[3px] bg-[color:var(--kb-brand)]" style={{ width: `${(next.done / next.total) * 100}%` }} />
            </span>
            <span className="text-[14px] text-[color:var(--kb-ink-2)]">Next: {next.title}</span>
          </Link>
        ) : (
          <Link href={`${base}/billing`} className="flex flex-col rounded-[10px] border border-[color:var(--kb-sand)] bg-[color:var(--kb-cream)] p-3.5 text-ink no-underline">
            <span className="text-[14px] font-semibold">{plan.line}</span>
            <span className="text-[14px] text-[color:var(--kb-ink-3)]">{plan.hint}</span>
          </Link>
        )}
        <div className="flex items-center gap-2.5 px-2 py-1">
          {account.node}
          <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
            <span className="truncate text-[14px] font-semibold">{account.name}</span>
            <span className="text-[14px] text-[color:var(--kb-ink-3)]">Organiser</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

/** The bar above every organiser screen on a wide screen: where you are, and the way across to the gallery. */
export function AdminTopbar({ handle, eventName, counts, plan }: Shared & { eventName: string }) {
  const base = `/admin/${handle}`;
  const { current } = useCurrent(navGroups(base, counts, plan.short));
  const pathname = usePathname();
  // Screens that aren't in the menu still say where you are.
  const extra = pathname.startsWith(`${base}/setup`)
    ? "Setup"
    : pathname.startsWith(`${base}/export`)
      ? "Download everything"
      : pathname.startsWith(`${base}/settings/deleted`)
        ? "Recently deleted"
        : null;
  return (
    <div className="sticky top-0 z-20 hidden h-16 flex-none items-center justify-between gap-4 border-b border-[color:var(--kb-line)] bg-white px-10 lg:flex">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[14px] text-[color:var(--kb-ink-3)]">
        <Link href={base} className="truncate text-[color:var(--kb-ink-3)] no-underline hover:text-[color:var(--kb-ink)]">
          {eventName}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-[color:var(--kb-ink)]" aria-current="page">
          {extra ?? current?.label ?? "Overview"}
        </span>
      </nav>
      <Link href={`/e/${handle}`} className="btn btn-secondary no-underline">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Attendee view
      </Link>
    </div>
  );
}

/**
 * On a phone: a bar naming the current screen. Tapping it folds the menu open
 * from the bar itself, over the page, and the chevron turns; tapping outside,
 * Escape or choosing a screen folds it shut.
 */
export function AdminMenuButton({ handle, counts, plan }: Shared) {
  const base = `/admin/${handle}`;
  const groups = navGroups(base, counts, plan.short);
  const { isActive, current } = useCurrent(groups);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = trigger.current;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setOpen(false);
      button?.focus();
    };
    const onPointer = (ev: PointerEvent) => {
      if (!root.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const label = current?.label ?? "Overview";

  return (
    <div ref={root} className="relative z-30 lg:hidden">
      <button
        ref={trigger}
        type="button"
        className={`flex min-h-[52px] w-full cursor-pointer items-center gap-3 border border-[color:var(--kb-line)] bg-white px-4 text-left text-[16px] font-semibold text-ink shadow-[0_1px_2px_rgb(22_24_29/0.04)] transition-[border-radius,box-shadow] duration-200 ${
          open ? "rounded-t-[12px] border-b-[color:var(--kb-sand)] shadow-[0_18px_40px_-18px_rgb(22_24_29/0.3)]" : "rounded-[12px]"
        }`}
        aria-expanded={open}
        aria-controls="organiser-menu"
        aria-label={`${label}. Organiser menu`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-[color:var(--kb-brand)]">
          <Icon name={current?.icon ?? "overview"} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {counts.removals > 0 ? (
          <span className="mono rounded-full bg-[color:var(--kb-warn-tint)] px-2 text-[14px] font-normal text-[color:var(--kb-warn)]">{counts.removals}</span>
        ) : null}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-none text-[color:var(--kb-ink-3)] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {/* Folds down from the bar: rows 0fr to 1fr, so it opens to its own height. */}
      <div
        className={`absolute inset-x-0 top-full grid transition-[grid-template-rows,opacity] duration-[260ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div
          ref={panel}
          id="organiser-menu"
          inert={!open}
          className="min-h-0 overflow-hidden rounded-b-[12px] border-x border-b border-[color:var(--kb-line)] bg-white shadow-[0_18px_40px_-18px_rgb(22_24_29/0.3)]"
        >
          <nav aria-label="Organiser" className="max-h-[70dvh] overflow-y-auto px-2 pb-2.5 pt-1">
            <NavList groups={groups} isActive={isActive} onPick={() => setOpen(false)} />
          </nav>
        </div>
      </div>
    </div>
  );
}

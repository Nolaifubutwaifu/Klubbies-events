import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { EventSwitcher } from "@/components/EventSwitcher";
import { ViewToggle } from "@/components/ViewToggle";
import { currentArea } from "@/lib/area";
import { displayNameFor } from "@/lib/auth/display-name";
import { listMyEvents, type EventContext } from "@/lib/auth/session";
import { canWrite } from "@/lib/billing/status";
import { formatLongDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function AppHeader({
  ctx,
  forceAdmin = false,
  photosOfYou = false,
}: {
  ctx: EventContext;
  forceAdmin?: boolean;
  /** Face recognition is on here and this member has enrolled. */
  photosOfYou?: boolean;
}) {
  const [{ events, invites }, displayName, area] = await Promise.all([
    listMyEvents(),
    displayNameFor(ctx),
    currentArea(),
  ]);
  const { event, membership, perms } = ctx;
  const adminArea = (forceAdmin || area === "admin") && perms.manage_event;

  // Every logo the header can show, in one call: the current event's, plus
  // each event in the switcher list. The dropdown used to fall back to
  // initials even for events whose logo was already uploaded.
  const signed = await signLogoMarks(await createClient(), [event.logo_path, ...events.map((c) => c.logoPath)]);
  const logoUrl = event.logo_path ? (signed.get(event.logo_path) ?? null) : null;
  const eventLogoUrls: Record<string, string> = {};
  for (const c of events) {
    const url = c.logoPath ? signed.get(c.logoPath) : null;
    if (url) eventLogoUrls[c.eventId] = url;
  }

  const memberLinks = [
    { href: `/e/${event.handle}`, label: "Events" },
    ...(photosOfYou ? [{ href: `/e/${event.handle}/me`, label: "Photos of you" }] : []),
    { href: `/e/${event.handle}/saved`, label: "Saved" },
    { href: `/e/${event.handle}/feed`, label: "Event feed" },
  ];

  // The switcher is the one menu a phone always has, so the two places that
  // otherwise only live in the desktop rail get a door here too.
  const shortcuts = [
    ...(photosOfYou ? [{ href: `/e/${event.handle}/me`, label: "Photos of you" }] : []),
    ...(perms.manage_event
      ? [forceAdmin ? { href: `/e/${event.handle}`, label: "Member view" } : { href: `/admin/${event.handle}`, label: "Admin view" }]
      : []),
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-[1320px] px-4 pt-3 sm:px-6">
        {/* One row: the event you're in, and you. Everything else lives in the
            tab bar, the rail or the account menu. */}
        <header className="flex items-center gap-2 border-b border-[color:var(--kb-line)] pb-3 sm:gap-3">
          <Link href="/events" className="soft-wordmark hidden text-[22px] no-underline sm:block">
            klubbies
          </Link>
          <EventSwitcher
            current={{ name: event.name, handle: event.handle, accentColour: event.accent_colour }}
            events={events}
            invites={invites}
            logoUrl={logoUrl}
            eventLogoUrls={eventLogoUrls}
            shortcuts={shortcuts}
          />
          <div className="ml-auto flex items-center gap-2">
            {perms.manage_event ? (
              <span className="hidden sm:block">
                <ViewToggle area={adminArea ? "admin" : "member"} handle={event.handle} />
              </span>
            ) : null}
            <AccountMenu name={displayName} />
          </div>
        </header>
      </div>

      {/* Members get their sections here on a wide screen; on a phone the
          tab bar at the bottom of the window carries them instead. */}
      {adminArea ? null : (
        <nav className="mx-auto hidden w-full max-w-[1320px] flex-wrap gap-2 px-4 pb-2 pt-3 sm:flex sm:px-6">
          {memberLinks.map((link) => (
            <Link key={link.href} href={link.href} className="soft-chip soft-chip-muted no-underline">
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      {adminArea && !canWrite(event.billing_status) ? (
        <div className="kb-info mx-4 mt-3 flex-wrap items-center justify-between sm:mx-6">
          <span>This event isn&apos;t active yet. Adding members and uploading unlock after payment.</span>
          <Link href={`/admin/${event.handle}/billing`} className="btn btn-primary btn-sm">
            Activate event
          </Link>
        </div>
      ) : null}

      {membership?.status === "grace" && membership.grace_ends_at ? (
        <div className="kb-info mx-4 mt-3 sm:mx-6">
          <span>
            <strong>Your access to {event.name} ends on {formatLongDate(membership.grace_ends_at)}.</strong> You can still
            open and download everything shared before you left the member list.
          </span>
        </div>
      ) : null}
    </>
  );
}

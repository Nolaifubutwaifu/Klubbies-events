import Link from "next/link";
import { EventMark } from "@/components/EventMark";
import { MoreMenu, MoreSeparator } from "@/components/MoreMenu";
import { listMyEvents } from "@/lib/auth/session";
import { formatEventDates } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * The small button beside the event's name in the header: every event you're
 * part of, one tap away. Organisers land on the side they're on now (an
 * organiser browsing the gallery goes to other galleries, and so on).
 */
export async function EventSwitcher({ currentEventId, area }: { currentEventId: string; area: "attendee" | "organiser" }) {
  const events = await listMyEvents();
  const logos = await signLogoMarks(await createClient(), events.map((event) => event.logoPath));

  return (
    <MoreMenu
      label="Switch event"
      // Placed against the header row, not the button, so on a phone the
      // list starts at the screen's left edge instead of running off the right.
      rootClassName="inline-flex"
      menuClassName="left-3 sm:left-auto"
      triggerClassName="kb-icon-btn flex-none"
      trigger={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      }
    >
      <span className="block px-2.5 pb-1 pt-2 text-[14px] font-medium text-[color:var(--kb-ink-3)]">Your events</span>
      <div className="flex max-h-[min(60vh,420px)] w-[min(86vw,320px)] flex-col overflow-y-auto">
        {events.map((event) => {
          const current = event.eventId === currentEventId;
          const href = area === "organiser" && event.isAdmin ? `/admin/${event.handle}` : `/e/${event.handle}`;
          const meta = [event.roleName, formatEventDates(event.startsOn, event.endsOn)].filter(Boolean).join(" · ");
          return (
            <Link
              key={event.membershipId}
              href={href}
             
              aria-current={current ? "page" : undefined}
              className={`kb-menu-item !min-h-[52px] !py-1.5 ${current ? "!bg-[color:var(--kb-sand)]" : ""}`}
            >
              <EventMark name={event.name} logoUrl={event.logoPath ? logos.get(event.logoPath) : null} accentColour={event.accentColour} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium leading-tight">{event.name}</span>
                <span className="block truncate text-[14px] font-normal leading-tight text-[color:var(--kb-ink-3)]">{meta}</span>
              </span>
              {current ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--kb-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-label="Current event">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              ) : null}
            </Link>
          );
        })}
      </div>
      <MoreSeparator />
      <Link href="/events" className="kb-menu-item">
        All your events
      </Link>
      <Link href="/admin/new" className="kb-menu-item">
        Create an event
      </Link>
    </MoreMenu>
  );
}

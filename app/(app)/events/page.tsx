/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { DeletedUndo } from "@/components/DeletedUndo";
import { EventMark } from "@/components/EventMark";
import { SimpleHeader } from "@/components/SimpleHeader";
import { ScanEventButton } from "@/components/ScanEventButton";
import { accessHasEnded, getProfile, listMyEvents, requireUser } from "@/lib/auth/session";
import { formatDate, formatEventDates, formatLongDate, plural } from "@/lib/format";
import { listBinnedEventsFor, recentlyDeleted, restorableUntil } from "@/lib/media/bin";
import { listEventCards } from "@/lib/media/event-cards";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { eventToneStyle } from "@/lib/theme";
import { DeletedEvents } from "./DeletedEvents";

export const metadata: Metadata = { title: "Your events" };

export default async function EventsPage(props: PageProps<"/events">) {
  const user = await requireUser("/events");
  const [events, profile, binned, { deleted }] = await Promise.all([
    listMyEvents(),
    getProfile(),
    listBinnedEventsFor(user.id),
    props.searchParams,
  ]);
  // The Undo bar after "Delete this event", only for an event this person
  // runs and only in the minute after it was deleted.
  const recent = await recentlyDeleted("events", deleted);
  const justDeleted = recent && binned.some((e) => e.id === recent.id) ? recent : null;
  const supabase = await createClient();
  const [cards, logos] = await Promise.all([
    listEventCards(supabase, events.map((e) => e.eventId), user.id),
    signLogoMarks(supabase, events.map((e) => e.logoPath)),
  ]);

  const meta = (event: (typeof events)[number]) =>
    [formatEventDates(event.startsOn, event.endsOn), event.organisation ?? event.venue].filter(Boolean).join(" · ") ||
    `Joined ${formatDate(event.since)}`;
  // Organisers open their event's admin, where an unfinished setup is
  // waiting; the gallery is one tap away from there.
  const hrefFor = (event: (typeof events)[number]) => (event.isAdmin ? `/admin/${event.handle}` : `/e/${event.handle}`);
  const [featured, ...rest] = events;

  function Chip({ event }: { event: (typeof events)[number] }) {
    const card = cards.get(event.eventId);
    const closed = !event.isAdmin && accessHasEnded({ access_ends_at: event.accessEndsAt });
    if (closed) return <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Closed</span>;
    if (event.isAdmin || event.roleName !== "Attendee")
      return <span className="kb-chip bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]">{event.isAdmin ? "Organiser" : event.roleName}</span>;
    if (card && card.newCount > 0) return <span className="kb-chip bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember-deep)]">{card.newCount} new</span>;
    return null;
  }

  return (
    <main className="flex flex-1 flex-col">
      <SimpleHeader name={profile?.display_name ?? profile?.email ?? "You"} />

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-5 pb-10 pt-7 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="serif text-[40px] leading-[1.02] sm:text-[48px]">Your events</h1>
            <p className="text-[15px] text-[color:var(--kb-ink-2)]">Newest first. Only events you&apos;ve joined show here.</p>
          </div>
          <ScanEventButton className="btn btn-primary" />
        </div>

        {events.length === 0 && binned.length === 0 ? (
          <div className="soft-dashed flex flex-col items-start gap-2 p-7">
            <span className="text-[17px] font-semibold">No events yet</span>
            <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
              Open the link or scan the QR code the organiser shared, and the event appears here. If the event uses a
              guest list, make sure the organiser has {profile?.email ?? "your email"} on it.
            </p>
          </div>
        ) : null}

        {featured
          ? (() => {
              const card = cards.get(featured.eventId);
              const closed = !featured.isAdmin && accessHasEnded({ access_ends_at: featured.accessEndsAt });
              const cover = closed ? null : (card?.tiles[0] ?? null);
              const logoUrl = featured.logoPath ? (logos.get(featured.logoPath) ?? null) : null;
              return (
                <Link
                  href={hrefFor(featured)}
                  className="flex flex-col overflow-hidden rounded-[12px] border border-[color:var(--kb-line)] bg-white text-ink no-underline hover:border-[color:var(--kb-line-strong)]"
                  style={eventToneStyle(featured.accentColour)}
                >
                  <span className="relative block h-[112px] bg-[color:var(--tone-support,var(--kb-sand))] sm:h-[160px]">
                    {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
                    <span className="absolute -bottom-[18px] left-3.5 rounded-[12px] bg-white p-[3px]">
                      <EventMark name={featured.name} logoUrl={logoUrl} accentColour={featured.accentColour} size={44} />
                    </span>
                  </span>
                  <span className="flex flex-col gap-1 px-3.5 pb-3.5 pt-[26px]">
                    <span className="text-[17px] font-semibold">{featured.name}</span>
                    <span className="text-[14px] text-[color:var(--kb-ink-2)]">{meta(featured)}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip event={featured} />
                      <span className="text-[14px] text-[color:var(--kb-ink-3)]">{card?.itemCount ? plural(card.itemCount, "photo") : "No photos yet"}</span>
                    </span>
                  </span>
                </Link>
              );
            })()
          : null}

        {rest.map((event) => {
          const logoUrl = event.logoPath ? (logos.get(event.logoPath) ?? null) : null;
          return (
            <Link
              key={event.membershipId}
              href={hrefFor(event)}
              className="flex items-center gap-3.5 rounded-[12px] border border-[color:var(--kb-line)] bg-white p-3.5 text-ink no-underline hover:border-[color:var(--kb-line-strong)]"
            >
              <EventMark name={event.name} logoUrl={logoUrl} accentColour={event.accentColour} size={52} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[16px] font-semibold">{event.name}</span>
                <span className="truncate text-[14px] text-[color:var(--kb-ink-2)]">{meta(event)}</span>
              </span>
              <Chip event={event} />
            </Link>
          );
        })}

        {binned.length ? (
          <DeletedEvents
            events={binned.map((e) => ({ id: e.id, name: e.name, restoreBy: formatLongDate(restorableUntil(e.deletedAt)) }))}
          />
        ) : null}

        <div className="mt-4 flex items-start gap-3 rounded-[12px] bg-[color:var(--kb-sand)] p-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none text-[color:var(--kb-ink-2)]">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
            <path d="M9 9h2v2H9zM13 13h2v2h-2zM13 9h2M9 13v2" />
          </svg>
          <p className="text-[14px] text-[color:var(--kb-ink-2)]">
            Missing an event? Scan its QR code or open the link the organiser shared. <Link href="/admin/new">Create an event</Link>
          </p>
        </div>
      </div>

      {justDeleted ? <DeletedUndo kind="event" id={justDeleted.id} name={justDeleted.name} /> : null}
    </main>
  );
}

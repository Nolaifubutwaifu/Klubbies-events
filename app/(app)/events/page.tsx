/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { DeletedUndo } from "@/components/DeletedUndo";
import { EventMark } from "@/components/EventMark";
import { SimpleHeader } from "@/components/SimpleHeader";
import { ScanEventButton } from "@/components/ScanEventButton";
import { PageTitle } from "@/components/ui";
import { accessHasEnded, getProfile, listMyEvents, requireUser } from "@/lib/auth/session";
import { formatDate, formatEventDates, formatLongDate, plural } from "@/lib/format";
import { listBinnedEventsFor, recentlyDeleted, restorableUntil } from "@/lib/media/bin";
import { listEventCards } from "@/lib/media/event-cards";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <main className="flex flex-1 flex-col">
      <SimpleHeader name={profile?.display_name ?? profile?.email ?? "You"} />

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle title="Your events">Every event you can open, newest first.</PageTitle>
          <div className="flex flex-wrap gap-2">
            <ScanEventButton className="btn btn-primary" />
            <Link href="/admin/new" className="btn btn-secondary no-underline">
              Create an event
            </Link>
          </div>
        </div>

        {events.length === 0 && binned.length === 0 ? (
          <div className="soft-dashed flex max-w-[640px] flex-col items-start gap-2 p-7">
            <span className="text-[17px] font-semibold">No events yet</span>
            <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
              Open the link or scan the QR code the organiser shared, and the event appears here. If the event uses a
              guest list, make sure the organiser has {profile?.email ?? "your email"} on it.
            </p>
          </div>
        ) : (
          <div className="grid gap-x-5 gap-y-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {events.map((event) => {
              const card = cards.get(event.eventId);
              const closed = !event.isAdmin && accessHasEnded({ access_ends_at: event.accessEndsAt });
              const logoUrl = event.logoPath ? (logos.get(event.logoPath) ?? null) : null;
              return (
                <Link
                  key={event.membershipId}
                  href={`/e/${event.handle}`}
                  className="group flex flex-col gap-3 text-ink no-underline"
                  aria-label={`${event.name}${card?.itemCount ? `, ${plural(card.itemCount, "photo")}` : ""}`}
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-[var(--kb-r-card)] bg-[color:var(--kb-sand)]">
                    {card?.tiles.length && !closed ? (
                      <span
                        className="grid h-full w-full gap-[2px]"
                        style={{
                          gridTemplateColumns: card.tiles.length > 1 ? "repeat(3, minmax(0, 1fr))" : "1fr",
                          gridTemplateRows: card.tiles.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr",
                        }}
                      >
                        {card.tiles.slice(0, 3).map((url, i) => (
                          <span
                            key={url}
                            className="soft-skeleton block overflow-hidden !rounded-none"
                            style={i === 0 && card.tiles.length > 1 ? { gridColumn: "span 2", gridRow: "span 2" } : undefined}
                          >
                            <img src={url} alt="" loading="lazy" className="relative z-[1] h-full w-full object-cover" />
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <EventMark name={event.name} logoUrl={logoUrl} accentColour={event.accentColour} size={64} />
                      </span>
                    )}
                    {closed ? (
                      <span className="absolute left-3 top-3 rounded-[6px] bg-[rgb(22_24_29/0.78)] px-2 py-0.5 text-[14px] font-medium text-white">
                        Closed
                      </span>
                    ) : card && card.newCount > 0 ? (
                      <span className="absolute left-3 top-3 rounded-[6px] bg-white px-2 py-0.5 text-[14px] font-medium text-ink">
                        {card.newCount} new
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="serif text-[26px]">{event.name}</span>
                    </span>
                    <span className="text-[14px] text-[color:var(--kb-ink-2)]">
                      {[formatEventDates(event.startsOn, event.endsOn), event.venue].filter(Boolean).join(" · ") ||
                        `Joined ${formatDate(event.since)}`}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[14px] text-[color:var(--kb-ink-3)]">
                      {event.isAdmin || event.roleName !== "Attendee" ? <span className="soft-chip">{event.roleName}</span> : null}
                      {card?.itemCount ? plural(card.itemCount, "photo") : "No photos yet"}
                      {event.organisation ? ` · ${event.organisation}` : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {binned.length ? (
          <DeletedEvents
            events={binned.map((e) => ({ id: e.id, name: e.name, restoreBy: formatLongDate(restorableUntil(e.deletedAt)) }))}
          />
        ) : null}
      </div>

      {justDeleted ? <DeletedUndo kind="event" id={justDeleted.id} name={justDeleted.name} /> : null}
    </main>
  );
}

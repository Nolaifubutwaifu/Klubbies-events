/* eslint-disable @next/next/no-img-element -- short-lived signed URL */
import type { ReactNode } from "react";
import { EventMark } from "@/components/EventMark";
import { formatEventDates } from "@/lib/format";

/**
 * The event's own letterhead: logo, serif name, dates, venue and host. Used
 * on the join and closed screens, where the event has to vouch for itself.
 */
export function EventIntro({
  name,
  organisation,
  startsOn,
  endsOn,
  venue,
  logoUrl,
  accentColour,
  children,
}: {
  name: string;
  organisation: string | null;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  logoUrl: string | null;
  accentColour: string | null;
  children?: ReactNode;
}) {
  const meta = [formatEventDates(startsOn, endsOn), venue].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col items-start gap-4">
      <EventMark name={name} logoUrl={logoUrl} accentColour={accentColour} size={56} />
      <div>
        <h1 className="serif text-[clamp(38px,6vw,56px)]">{name}</h1>
        {meta ? <p className="m-0 mt-2 text-[15px] text-[color:var(--kb-ink-2)]">{meta}</p> : null}
        {organisation ? <p className="m-0 mt-1 text-[14px] text-[color:var(--kb-ink-3)]">Hosted by {organisation}</p> : null}
      </div>
      {children}
    </div>
  );
}

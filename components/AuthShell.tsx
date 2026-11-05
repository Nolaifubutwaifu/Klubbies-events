import Image from "next/image";
import type { ReactNode } from "react";
import { EventMark } from "@/components/EventMark";
import { Brand } from "@/components/ui";
import { formatEventDates } from "@/lib/format";
import { eventToneStyle } from "@/lib/theme";

export type AuthEvent = {
  name: string;
  handle: string;
  logoUrl: string | null;
  organisation: string | null;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  accentColour: string | null;
  accessMode: "link" | "guest_list";
};

// The panel sits under "Every photo you're in", so these are photos the sample attendee is in.
const ART_PHOTOS = ["sq-5", "sq-4", "sq-10", "sq-9", "sq-1", "sq-3"];

/** The default panel: Klubbies' own marketing photos fading into night. */
function PhotoPanel() {
  return (
    <div aria-hidden className="relative flex h-full flex-col justify-end overflow-hidden bg-[color:var(--kb-night)] p-14">
      <div className="absolute inset-x-10 top-10 grid grid-cols-3 gap-1.5">
        {ART_PHOTOS.map((name) => (
          <span key={name} className="relative block aspect-square overflow-hidden rounded-[6px]">
            <Image src={`/marketing/${name}.webp`} alt="" fill sizes="16vw" className="object-cover" />
          </span>
        ))}
      </div>
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(14_20_36/0)_30%,#0e1424_72%)]" />
      <div className="relative flex max-w-[480px] flex-col gap-4">
        <span className="flex items-center gap-2.5 text-[14px] font-semibold uppercase tracking-[0.08em] text-[#b3c1f6]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Private to the people who were there
        </span>
        <p className="serif m-0 text-[44px] leading-[1.05] text-white">Every photo you&apos;re in, at full quality.</p>
      </div>
    </div>
  );
}

/** Someone arrived through an event's link: its letterhead, in its colour. Never a photo from its gallery. */
function EventPanel({ event, meta }: { event: AuthEvent; meta: string }) {
  return (
    <div className="flex h-full flex-col justify-between bg-[color:var(--kb-ember)] p-14 text-white">
      <span className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.08em] text-white/90">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        {event.accessMode === "guest_list" ? "Guest list event" : "Private gallery"}
      </span>
      <div className="flex flex-col gap-5">
        <span className="rounded-[18px] bg-white/15 p-1 self-start">
          <EventMark name={event.name} logoUrl={event.logoUrl} accentColour={event.accentColour} size={72} />
        </span>
        <h2 className="serif max-w-[14ch] text-[64px] leading-[1.02] !text-white">{event.name}</h2>
        {meta ? <p className="m-0 text-[17px] text-white">{meta}</p> : null}
        {event.organisation ? <p className="m-0 text-[17px] text-white">Hosted by {event.organisation}</p> : null}
      </div>
      <p className="m-0 max-w-[40ch] text-[15px] text-white">
        The photos from this event are private. Confirm your email to see them and find the ones you&apos;re in.
      </p>
    </div>
  );
}

/**
 * Sign in, Create an event and the code step. The form sits on paper at the
 * left; from 1024px a panel fills the right: the event's letterhead when
 * someone arrived through its link, otherwise night with marketing photos.
 * Event screens keep ink buttons (attendee), the rest go Klubbies blue.
 */
export function AuthShell({
  children,
  event = null,
  topLink,
  footer,
  panel,
  backHref,
}: {
  children: ReactNode;
  event?: AuthEvent | null;
  /** The one route out, top right. */
  topLink?: ReactNode;
  /** The small print under the form column. */
  footer?: ReactNode;
  /** Replaces the default panel on desktop. */
  panel?: ReactNode;
  /** A later step for someone from an event's link: on a phone, a slim bar with Back instead of the letterhead. */
  backHref?: string;
}) {
  const meta = event ? [formatEventDates(event.startsOn, event.endsOn), event.venue].filter(Boolean).join(" · ") : "";

  return (
    <div
      className={`theme-soft flex min-h-dvh flex-1 flex-col bg-[color:var(--kb-cream)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${event ? "" : "kb-branded"}`}
      style={eventToneStyle(event?.accentColour)}
    >
      <div className="flex min-h-dvh flex-col px-5 pb-6 pt-5 sm:px-10 sm:pt-8">
        <header className={`flex flex-none items-center justify-between gap-4 ${event ? "max-lg:hidden" : ""}`}>
          <Brand size={18} />
          {topLink ? <span className="text-right text-[14px] text-[color:var(--kb-ink-2)]">{topLink}</span> : null}
        </header>

        {/* Phone: the event's letterhead first, a band of its colour with the mark over the edge. */}
        {event && backHref ? (
          <div className="-mx-5 -mt-5 flex h-16 items-center gap-2 border-b border-[color:var(--kb-line)] px-3 sm:-mx-10 sm:-mt-8 lg:hidden">
            <a href={backHref} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[color:var(--kb-ink)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </a>
            <EventMark name={event.name} logoUrl={event.logoUrl} accentColour={event.accentColour} size={32} />
            <span className="truncate text-[15px] font-semibold">{event.name}</span>
          </div>
        ) : event ? (
          <div className="-mx-5 -mt-5 sm:-mx-10 sm:-mt-8 lg:hidden">
            <div className="relative h-[150px] bg-[color:var(--kb-ember)]">
              <span className="absolute -bottom-8 left-5 rounded-[18px] bg-[color:var(--kb-cream)] p-1 sm:left-10">
                <EventMark name={event.name} logoUrl={event.logoUrl} accentColour={event.accentColour} size={72} />
              </span>
            </div>
            <div className="mx-auto flex max-w-[440px] flex-col gap-2 px-5 pt-12 sm:px-0">
              {event.accessMode === "guest_list" ? <GuestListLabel /> : null}
              <span className="serif text-[38px] leading-[1.02]">{event.name}</span>
              {meta ? <span className="text-[15px] text-[color:var(--kb-ink-2)]">{meta}</span> : null}
              {event.organisation ? <span className="text-[15px] text-[color:var(--kb-ink-2)]">Hosted by {event.organisation}</span> : null}
            </div>
          </div>
        ) : null}

        <main className="flex flex-1 flex-col">
          <div className={`mx-auto w-full max-w-[440px] lg:my-auto lg:py-12 ${event ? "pb-8 pt-6" : "my-auto py-8"}`}>{children}</div>
        </main>

        <footer className="flex-none text-[14px] text-[color:var(--kb-ink-3)]">
          {footer ??
            (event ? (
              <p className="m-0 flex items-center justify-center gap-2 lg:justify-start">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Private gallery by Klubbies Events · <a href="/privacy">Privacy</a>
              </p>
            ) : (
              <p className="m-0">
                By continuing you agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.
              </p>
            ))}
        </footer>
      </div>

      <div className="relative hidden lg:block">{panel ?? (event ? <EventPanel event={event} meta={meta} /> : <PhotoPanel />)}</div>
    </div>
  );
}

function GuestListLabel() {
  return (
    <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[color:var(--kb-ember)]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      Guest list event
    </span>
  );
}

/** Heading for an auth screen: names the task, never a marketing line. */
export function AuthHeading({ children, step }: { children: ReactNode; step?: { at: number; of: number } }) {
  return (
    <div className="flex flex-col gap-3.5">
      {step ? (
        <div className="flex items-center gap-3">
          <span className="mono text-[14px] font-medium text-[color:var(--kb-brand-deep)]">
            Step {step.at} of {step.of}
          </span>
          <span className="flex flex-1 gap-1" aria-hidden>
            {Array.from({ length: step.of }, (_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-[2px] ${i < step.at ? "bg-[color:var(--kb-brand)]" : "bg-[color:var(--kb-line)]"}`} />
            ))}
          </span>
        </div>
      ) : null}
      <h1 className="serif text-balance text-[44px] leading-none sm:text-[56px]">{children}</h1>
    </div>
  );
}

/** Info box: mist, one icon, one sentence. */
export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <div className="kb-info mt-6">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-none" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.6v.1" />
      </svg>
      <p className="m-0 text-[14px]">{children}</p>
    </div>
  );
}

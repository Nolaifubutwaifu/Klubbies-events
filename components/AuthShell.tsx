import Link from "next/link";
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

/**
 * Sign in, Create an event and the code step. From 1024px a panel sits beside
 * the form: the event's own letterhead when someone arrived through its link,
 * otherwise a plain statement of what this is. Never a photo: the page is
 * public, and nothing from an event's gallery shows to anyone not let in.
 */
export function AuthShell({
  children,
  event = null,
  topLink,
  footerLinks = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ],
  panel,
}: {
  children: ReactNode;
  event?: AuthEvent | null;
  /** The one route out, top right. */
  topLink?: ReactNode;
  footerLinks?: { href: string; label: string }[];
  /** Replaces the default panel on desktop. */
  panel?: ReactNode;
}) {
  const meta = event ? [formatEventDates(event.startsOn, event.endsOn), event.venue].filter(Boolean).join(" · ") : "";

  return (
    <div className="theme-soft flex min-h-dvh flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={eventToneStyle(event?.accentColour)}>
      <div className="relative hidden lg:block">
        {panel ??
          (event ? (
            <div className="flex h-full flex-col justify-between border-r border-[color:var(--kb-line)] bg-[color:var(--kb-white)] p-12 xl:p-16">
              <span className="h-1 w-16 rounded-full bg-[color:var(--kb-ember)]" aria-hidden />
              <div className="flex flex-col gap-5">
                <EventMark name={event.name} logoUrl={event.logoUrl} accentColour={event.accentColour} size={72} />
                {event.organisation ? <span className="kb-eyebrow">Hosted by {event.organisation}</span> : null}
                <h2 className="serif max-w-[14ch] text-[64px]">{event.name}</h2>
                {meta ? <p className="m-0 text-[17px] text-[color:var(--kb-ink-2)]">{meta}</p> : null}
              </div>
              <p className="m-0 max-w-[40ch] text-[15px] text-[color:var(--kb-ink-3)]">
                The photos from this event are private. Confirm your email to see them and find the ones you&apos;re in.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between bg-[color:var(--kb-ink)] p-12 text-white xl:p-16">
              <span className="h-1 w-16 rounded-full bg-[#5b78f0]" aria-hidden />
              <p className="serif m-0 max-w-[16ch] text-[56px] text-white">
                Every photo from your event, in every attendee&apos;s hands.
              </p>
              <p className="m-0 max-w-[44ch] text-[15px] text-white/80">
                Private galleries for corporate events and meetups. Photographers upload, attendees find themselves with
                a selfie.
              </p>
            </div>
          ))}
      </div>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 flex-none items-center justify-between gap-3 px-5 lg:h-20 lg:px-12">
          <Brand />
          {topLink ? <span className="text-right text-[14px] text-[color:var(--kb-ink-2)]">{topLink}</span> : null}
        </header>

        <main className="flex flex-1 flex-col px-5 lg:justify-center lg:px-12">
          <div className="mx-auto w-full max-w-[440px] py-4 lg:py-10">
            {/* Phone: the event's letterhead above the form. */}
            {event ? (
              <div className="mb-8 flex flex-col gap-3 lg:hidden">
                <EventMark name={event.name} logoUrl={event.logoUrl} accentColour={event.accentColour} size={52} />
                <span className="serif text-[38px]">{event.name}</span>
                {meta || event.organisation ? (
                  <span className="text-[14px] text-[color:var(--kb-ink-2)]">
                    {[meta, event.organisation ? `Hosted by ${event.organisation}` : null].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </div>
            ) : null}
            {children}
          </div>
        </main>

        <footer className="flex flex-none justify-center gap-6 px-5 pb-6 pt-4 lg:justify-start lg:px-12">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="flex min-h-[44px] items-center text-[14px] text-[color:var(--kb-ink-3)] no-underline hover:underline">
              {link.label}
            </Link>
          ))}
        </footer>
      </div>
    </div>
  );
}

/** Heading for an auth screen: names the task, never a marketing line. */
export function AuthHeading({ children, chip }: { children: ReactNode; chip?: ReactNode }) {
  return (
    <div>
      {chip ? <span className="kb-eyebrow mb-2 block">{chip}</span> : null}
      <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] lg:text-[36px]">{children}</h1>
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

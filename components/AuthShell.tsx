import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export type AuthEvent = { name: string; handle: string; logoUrl: string | null; organisation: string | null };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function EventBadge({ event, size = 44 }: { event: AuthEvent; size?: number }) {
  return (
    <span
      className="relative flex flex-none items-center justify-center overflow-hidden rounded-[14px] bg-white text-[15px] font-bold text-[color:var(--kb-ink)]"
      style={{ width: size, height: size }}
    >
      {event.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={event.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(event.name)
      )}
    </span>
  );
}

/**
 * Log in, Start your event and the code step. A photo panel and the form side
 * by side from 1024px; on a phone, a short rounded photo that fades into the
 * page above the form.
 *
 * The photo is always a Klubbies marketing photo, never the event's own: the
 * page is public, and the product promises nobody off the list sees a single
 * thumbnail. The event is named and shown by its logo instead.
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
  photo = "/marketing/night-ball.jpg",
}: {
  children: ReactNode;
  event?: AuthEvent | null;
  /** The one route out, top right: "Running a event? Start your event". */
  topLink?: ReactNode;
  footerLinks?: { href: string; label: string }[];
  /** Replaces the photo panel on desktop (Start your event uses a preview). */
  panel?: ReactNode;
  photo?: string;
}) {
  return (
    <div className="theme-soft flex min-h-dvh flex-1 flex-col lg:grid lg:grid-cols-2">
      {/* Desktop: left panel. */}
      <div className="relative hidden overflow-hidden lg:block">
        {panel ?? (
          <>
            <Image src={photo} alt="" fill priority sizes="50vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(43_34_40/0.85)] via-[rgb(43_34_40/0.15)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-12 text-white">
              {event ? (
                <div className="flex items-center gap-4">
                  <EventBadge event={event} size={56} />
                  <span>
                    <span className="block font-[family-name:var(--kb-font-display)] text-[28px] font-semibold leading-tight">{event.name}</span>
                    <span className="block text-[16px] text-white/85">{event.organisation ?? "Members only albums"}</span>
                  </span>
                </div>
              ) : (
                <p className="max-w-[22ch] font-[family-name:var(--kb-font-display)] text-[34px] font-semibold leading-[1.15]">
                  Every photo from Friday, waiting on Saturday.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* The form column. */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 flex-none items-center justify-between gap-3 px-5 lg:h-20 lg:px-12">
          <Link href="/" className="soft-wordmark text-[24px] no-underline" aria-label="Klubbies home">
            klubbies
          </Link>
          {topLink ? <span className="text-right text-[15px] text-[color:var(--kb-ink-2)]">{topLink}</span> : null}
        </header>

        <main className="flex flex-1 flex-col px-5 lg:justify-center lg:px-12">
          <div className="mx-auto w-full max-w-[460px] py-4 lg:py-10">
            {/* Phone: a short photo that fades into the page, no hard edge. */}
            <div className="relative mb-7 h-[150px] overflow-hidden rounded-[var(--kb-r-card)] lg:hidden">
              <Image src={photo} alt="" fill priority sizes="100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-[rgb(43_34_40/0.1)] via-[rgb(43_34_40/0.35)] to-[color:var(--kb-cream)]" />
              {event ? (
                <div className="absolute bottom-3 left-4 flex items-center gap-3">
                  <EventBadge event={event} size={40} />
                  <span className="font-[family-name:var(--kb-font-display)] text-[20px] font-semibold text-[color:var(--kb-ink)]">{event.name}</span>
                </div>
              ) : null}
            </div>
            {children}
          </div>
        </main>

        <footer className="flex flex-none justify-center gap-6 px-5 pb-6 pt-4 lg:justify-start lg:px-12">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="flex min-h-[44px] items-center text-[15px] text-[color:var(--kb-ink-2)] no-underline hover:underline">
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
      {chip ? <span className="soft-chip mb-4">{chip}</span> : null}
      <h1 className="font-[family-name:var(--kb-font-display)] text-[38px] font-bold leading-[1.05] lg:text-[52px]">{children}</h1>
    </div>
  );
}

/** Info box: sand, one icon, one sentence. */
export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <div className="kb-info mt-6">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-0.5 flex-none" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.6v.1" />
      </svg>
      <p className="m-0">{children}</p>
    </div>
  );
}

/** Onboarding steps for a new event, shared by Start and Create your event. */
export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["You", "Your event", "Activate"];
  return (
    <ol className="m-0 mb-6 flex list-none gap-2 p-0" aria-label="Setup steps">
      {steps.map((label, i) => {
        const here = i + 1 === current;
        return (
          <li
            key={label}
            aria-current={here ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[14px] font-bold ${
              here ? "bg-[color:var(--kb-ink)] text-white" : "bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]"
            }`}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[14px] ${here ? "bg-white text-[color:var(--kb-ink)]" : "bg-white"}`}>{i + 1}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

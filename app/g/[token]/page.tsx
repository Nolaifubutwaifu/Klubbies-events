import type { Metadata } from "next";
import Link from "next/link";
import { EventMark } from "@/components/EventMark";
import { NoticePage } from "@/components/NoticePage";
import { formatLongDate } from "@/lib/format";
import { getPlanUsage } from "@/lib/billing/usage";
import { resolveGuestLink, type GuestLinkState } from "@/lib/guest/links";
import { signLogoMarks } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventToneStyle } from "@/lib/theme";
import { GuestUploader } from "./GuestUploader";

// A photographer's upload link is the only part of the product that works
// without an account, so it is deliberately small: one album, upload only.
export const metadata: Metadata = { title: "Upload", robots: { index: false, follow: false } };

const DEAD: Record<Exclude<GuestLinkState, "ok">, { title: string; body: string }> = {
  unknown: {
    title: "This link doesn't work.",
    body: "Check you copied the whole thing, including the dashes. If it still won't open, ask the organiser for a fresh one.",
  },
  revoked: {
    title: "This link has been turned off.",
    body: "Anything you already uploaded is safe with the event. Ask the organiser for a new link if you have more to add.",
  },
  expired: {
    title: "This link has expired.",
    body: "Upload links run out on a date the organiser picks. Ask them for a new one.",
  },
  unpaid: {
    title: "This event isn't active right now.",
    body: "Uploads are paused until the organiser activates the event. Nothing you already sent has been lost.",
  },
  full: {
    title: "This event is full.",
    body: "It has used all the photos its size allows. Ask the organiser to make room. Nothing you already sent has been lost.",
  },
};

export default async function GuestUploadPage(props: PageProps<"/g/[token]">) {
  const { token } = await props.params;
  const resolved = await resolveGuestLink(token);
  const usage = resolved.session ? await getPlanUsage(resolved.session.eventId) : null;
  // Out of photos: say so up front rather than failing each file.
  const full = Boolean(usage?.photoLimit && usage.unitsUsed >= usage.photoLimit);
  const { state, session } = full ? { state: "full" as const, session: null } : resolved;

  if (!session) {
    const copy = DEAD[state as Exclude<GuestLinkState, "ok">] ?? DEAD.unknown;
    return (
      <NoticePage
        badge="warn"
        title={copy.title}
        actions={
          <>
            <Link href="/support#contact" className="btn btn-primary no-underline">
              Ask for help
            </Link>
            <Link href="/" className="btn btn-secondary no-underline">
              Go to Klubbies Events
            </Link>
          </>
        }
      >
        <p>{copy.body}</p>
      </NoticePage>
    );
  }

  // The link is the credential here, so the logo is signed with the service
  // role after the link checked out. It is the only image this page shows.
  const logoUrl = session.eventLogoPath
    ? ((await signLogoMarks(createAdminClient(), [session.eventLogoPath])).get(session.eventLogoPath) ?? null)
    : null;
  const name = session.label.trim();

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div className="theme-soft relative flex min-h-dvh flex-col bg-[color:var(--kb-cream)]" style={eventToneStyle(session.eventAccent)}>
      <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--tone-support,var(--kb-sand))]">
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center gap-4 px-5 py-7 sm:px-8">
          <EventMark name={session.eventName} logoUrl={logoUrl} accentColour={session.eventAccent} size={52} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tone-support-ink,var(--kb-ink-2))]">Photographer upload</span>
            <h1 className="serif text-[34px] leading-[1.02] sm:text-[44px]">{session.eventName}</h1>
          </div>
          <span className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-[14px]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--kb-ink)] text-[13px] font-semibold text-white" aria-hidden>
              {initials}
            </span>
            <span>
              Uploading as <strong className="font-semibold">{name}</strong>
            </span>
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-5 px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="m-0 text-[17px]">
            Album: <strong className="font-semibold">{session.albumTitle}</strong>
          </p>
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
            Every photo is credited to you. Your link works until {formatLongDate(session.expiresAt)}.
          </p>
        </div>

        <GuestUploader token={token} />

        <div className="flex items-start gap-3 rounded-[10px] bg-[color:var(--kb-sand)] p-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none text-[color:var(--kb-ink-2)]">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 7.6v.1" />
          </svg>
          <div className="flex flex-col gap-1 text-[14px] text-[color:var(--kb-ink-2)]">
            <p className="m-0">
              Uploads keep going while this tab is open. If the connection drops, open this link again and drop the same
              files: finished ones are skipped and the rest carry on.
            </p>
            {session.fileCount > 0 ? (
              <p className="m-0">
                {session.fileCount.toLocaleString("en-AU")} file{session.fileCount === 1 ? "" : "s"} already came in on this link.
              </p>
            ) : null}
          </div>
        </div>
      </main>

      <footer className="px-5 pb-8 text-center text-[14px] text-[color:var(--kb-ink-3)]">
        Private upload link by Klubbies Events · You can&apos;t see the gallery from here.
      </footer>
    </div>
  );
}

import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { EventMark } from "@/components/EventMark";
import { HeaderNav } from "@/components/HeaderNav";
import { BrandTile } from "@/components/ui";
import { displayNameFor } from "@/lib/auth/display-name";
import { getProfile, type EventContext } from "@/lib/auth/session";
import { canWrite } from "@/lib/billing/status";
import { formatEventDates } from "@/lib/format";
import { SIGNED_URL_TTL, signLogoMarks, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * One slim bar on every event screen: the event you're in, its sections, and
 * you. Attendees get Photos, Your photos and Saved; organisers get a way
 * across to the other side. Phones carry the sections in the tab bar instead.
 */
export async function AppHeader({
  ctx,
  area,
  facesEnabled = false,
}: {
  ctx: EventContext;
  area: "attendee" | "organiser";
  /** Face recognition is on for this event, so "Your photos" exists. */
  facesEnabled?: boolean;
}) {
  const supabase = await createClient();
  const [displayName, profile] = await Promise.all([displayNameFor(ctx), getProfile()]);
  const { event, perms } = ctx;

  const [logos, avatars] = await Promise.all([
    signLogoMarks(supabase, [event.logo_path]),
    profile?.avatar_url ? signPaths(supabase, [profile.avatar_url], SIGNED_URL_TTL.display) : Promise.resolve(new Map<string, string>()),
  ]);
  const logoUrl = event.logo_path ? (logos.get(event.logo_path) ?? null) : null;
  const avatarUrl = profile?.avatar_url ? (avatars.get(profile.avatar_url) ?? null) : null;
  const dates = formatEventDates(event.starts_on, event.ends_on);

  const links =
    area === "attendee"
      ? [
          { href: `/e/${event.handle}`, label: "Photos", exact: true },
          ...(facesEnabled ? [{ href: `/e/${event.handle}/me`, label: "Your photos" }] : []),
          { href: `/e/${event.handle}/saved`, label: "Saved" },
        ]
      : [];

  return (
    <>
      <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
        <div className="mx-auto flex min-h-[60px] w-full max-w-[1320px] items-center gap-3 px-4 sm:px-6">
          <Link href="/events" aria-label="Your events" className="hidden flex-none sm:block">
            <BrandTile size={26} />
          </Link>
          <span className="hidden h-6 w-px bg-[color:var(--kb-line)] sm:block" aria-hidden />
          <Link
            href={area === "organiser" ? `/admin/${event.handle}` : `/e/${event.handle}`}
            className="flex min-w-0 items-center gap-2.5 text-ink no-underline"
          >
            <EventMark name={event.name} logoUrl={logoUrl} accentColour={event.accent_colour} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight">{event.name}</span>
              {dates ? <span className="block truncate text-[14px] leading-tight text-[color:var(--kb-ink-3)]">{dates}</span> : null}
            </span>
          </Link>

          {links.length ? <HeaderNav links={links} /> : null}

          <div className="ml-auto flex flex-none items-center gap-2">
            {perms.manage_albums ? (
              area === "organiser" ? (
                <Link href={`/e/${event.handle}`} className="btn btn-sm btn-secondary no-underline">
                  Attendee view
                </Link>
              ) : (
                <Link href={`/admin/${event.handle}`} className="btn btn-sm btn-secondary no-underline">
                  <span className="sm:hidden">Organise</span>
                  <span className="hidden sm:inline">Organiser view</span>
                </Link>
              )
            ) : null}
            <AccountMenu name={displayName} avatarUrl={avatarUrl} />
          </div>
        </div>
      </header>

      {area === "organiser" && !canWrite(event.billing_status) ? (
        <div className="mx-auto w-full max-w-[1320px] px-4 pt-3 sm:px-6">
          <div className="kb-info flex-wrap items-center justify-between">
            <span>This event isn&apos;t activated yet. Uploading and adding attendees unlock after payment.</span>
            <Link href={`/admin/${event.handle}/billing`} className="btn btn-primary btn-sm no-underline">
              Activate event
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

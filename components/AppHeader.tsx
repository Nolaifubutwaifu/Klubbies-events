import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { ClubSwitcher } from "@/components/ClubSwitcher";
import { ViewToggle } from "@/components/ViewToggle";
import { currentArea } from "@/lib/area";
import { displayNameFor } from "@/lib/auth/display-name";
import { listMyClubs, type ClubContext } from "@/lib/auth/session";
import { canWrite } from "@/lib/billing/status";
import { formatLongDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function AppHeader({
  ctx,
  forceAdmin = false,
  photosOfYou = false,
}: {
  ctx: ClubContext;
  forceAdmin?: boolean;
  /** Face recognition is on here and this member has enrolled. */
  photosOfYou?: boolean;
}) {
  const [{ clubs, invites }, displayName, area] = await Promise.all([
    listMyClubs(),
    displayNameFor(ctx),
    currentArea(),
  ]);
  const { club, membership, perms } = ctx;
  const adminArea = (forceAdmin || area === "admin") && perms.manage_club;

  // Every logo the header can show, in one call: the current club's, plus
  // each club in the switcher list. The dropdown used to fall back to
  // initials even for clubs whose logo was already uploaded.
  const signed = await signLogoMarks(await createClient(), [club.logo_path, ...clubs.map((c) => c.logoPath)]);
  const logoUrl = club.logo_path ? (signed.get(club.logo_path) ?? null) : null;
  const clubLogoUrls: Record<string, string> = {};
  for (const c of clubs) {
    const url = c.logoPath ? signed.get(c.logoPath) : null;
    if (url) clubLogoUrls[c.clubId] = url;
  }

  const memberLinks = [
    { href: `/c/${club.handle}`, label: "Events" },
    ...(photosOfYou ? [{ href: `/c/${club.handle}/me`, label: "Photos of you" }] : []),
    { href: `/c/${club.handle}/saved`, label: "Saved" },
    { href: `/c/${club.handle}/feed`, label: "Club feed" },
  ];

  // The switcher is the one menu a phone always has, so the two places that
  // otherwise only live in the desktop rail get a door here too.
  const shortcuts = [
    ...(photosOfYou ? [{ href: `/c/${club.handle}/me`, label: "Photos of you" }] : []),
    ...(perms.manage_club
      ? [forceAdmin ? { href: `/c/${club.handle}`, label: "Member view" } : { href: `/admin/${club.handle}`, label: "Admin view" }]
      : []),
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-[1320px] px-4 pt-3 sm:px-6">
        {/* One row: the club you're in, and you. Everything else lives in the
            tab bar, the rail or the account menu. */}
        <header className="flex items-center gap-2 border-b border-[color:var(--kb-line)] pb-3 sm:gap-3">
          <Link href="/clubs" className="soft-wordmark hidden text-[22px] no-underline sm:block">
            klubbies
          </Link>
          <ClubSwitcher
            current={{ name: club.name, handle: club.handle, accentColour: club.accent_colour }}
            clubs={clubs}
            invites={invites}
            logoUrl={logoUrl}
            clubLogoUrls={clubLogoUrls}
            shortcuts={shortcuts}
          />
          <div className="ml-auto flex items-center gap-2">
            {perms.manage_club ? (
              <span className="hidden sm:block">
                <ViewToggle area={adminArea ? "admin" : "member"} handle={club.handle} />
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

      {adminArea && !canWrite(club.billing_status) ? (
        <div className="kb-info mx-4 mt-3 flex-wrap items-center justify-between sm:mx-6">
          <span>This club isn&apos;t active yet. Adding members and uploading unlock after payment.</span>
          <Link href={`/admin/${club.handle}/billing`} className="btn btn-primary btn-sm">
            Activate club
          </Link>
        </div>
      ) : null}

      {membership?.status === "grace" && membership.grace_ends_at ? (
        <div className="kb-info mx-4 mt-3 sm:mx-6">
          <span>
            <strong>Your access to {club.name} ends on {formatLongDate(membership.grace_ends_at)}.</strong> You can still
            open and download everything shared before you left the member list.
          </span>
        </div>
      ) : null}
    </>
  );
}

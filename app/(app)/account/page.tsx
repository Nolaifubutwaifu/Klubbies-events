/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { EventMark } from "@/components/EventMark";
import { MemberTabBar } from "@/components/MemberTabBar";
import { SimpleHeader } from "@/components/SimpleHeader";
import { planAccountDeletion } from "@/lib/account/delete";
import { getProfile, getSessionUser, listMyEvents, requireUser } from "@/lib/auth/session";
import { SIGNED_URL_TTL, signLogoMarks, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { NotificationToggles, PasswordForm, ProfileRow } from "./AccountForms";
import { DeleteAccount } from "./DeleteAccount";
import { FaceRow } from "./FaceRow";
import { PhoneNotifications } from "./PhoneNotifications";

export const metadata: Metadata = { title: "Your profile" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AccountPage(props: PageProps<"/account">) {
  await requireUser("/account");
  const { event: from } = await props.searchParams;
  const [profile, user, events] = await Promise.all([getProfile(), getSessionUser(), listMyEvents()]);
  if (!profile || !user) return null;

  const supabase = await createClient();
  const [avatar, signed, deletion] = await Promise.all([
    profile.avatar_url ? signPaths(supabase, [profile.avatar_url], SIGNED_URL_TTL.display) : new Map<string, string>(),
    signLogoMarks(supabase, events.map((event) => event.logoPath)),
    planAccountDeletion(user.id),
  ]);
  const avatarUrl = profile.avatar_url ? (avatar.get(profile.avatar_url) ?? null) : null;
  // Set when the person saves a password from this page.
  const hasPassword = user.user_metadata?.has_password === true;
  const name = profile.display_name ?? profile.email;
  // The phone tab bar belongs to the event you came from ("You" carries it).
  const tabEvent = events.find((event) => event.handle === from) ?? events[0] ?? null;

  return (
    <main className="flex flex-1 flex-col">
      <SimpleHeader name={name} avatarUrl={avatarUrl} back={tabEvent && from ? `/e/${tabEvent.handle}` : "/events"} />

      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[26px] px-5 pb-24 pt-7 sm:px-8 sm:pt-10">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[color:var(--kb-ink)] text-[22px] font-semibold text-white">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
          </span>
          <span className="flex min-w-0 flex-col">
            <h1 className="serif truncate text-[34px] leading-[1.05]">{name}</h1>
            <span className="truncate text-[15px] text-[color:var(--kb-ink-2)]">{profile.email}</span>
          </span>
        </div>

        <section aria-labelledby="g-profile">
          <h2 id="g-profile" className="kb-group-title">
            Profile
          </h2>
          <div className="kb-group">
            <ProfileRow userId={user.id} displayName={profile.display_name ?? ""} email={profile.email} bio={profile.bio} avatarUrl={avatarUrl} />
            <div className="kb-row">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">Email</span>
                <span className="truncate">{profile.email}</span>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">Ask the event organiser to change it.</span>
              </span>
            </div>
          </div>
        </section>

        <section aria-labelledby="g-email">
          <h2 id="g-email" className="kb-group-title">
            Email me when
          </h2>
          <div className="kb-group">
            <PhoneNotifications />
            <NotificationToggles
              initial={{
                notify_new_album: profile.notify_new_album,
                notify_access_ending: profile.notify_access_ending,
              }}
            />
          </div>
        </section>

        <FaceRow events={events} />

        <section aria-labelledby="g-events">
          <h2 id="g-events" className="kb-group-title">
            Your events
          </h2>
          <div className="kb-group">
            {events.length ? (
              events.slice(0, 6).map((event) => (
                <Link key={event.membershipId} href={`/e/${event.handle}`} className="kb-row">
                  <EventMark name={event.name} logoUrl={event.logoPath ? signed.get(event.logoPath) : null} accentColour={event.accentColour} size={32} />
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{event.name}</span>
                    {event.isAdmin ? <span className="kb-chip bg-[color:var(--kb-brand-tint)] !min-h-[22px] !px-2 text-[color:var(--kb-brand-deep)]">Organiser</span> : null}
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))
            ) : (
              <p className="kb-row text-[15px] text-[color:var(--kb-ink-2)]">No events yet. Open the link or QR code an organiser shared to join one.</p>
            )}
            <Link href="/events" className="kb-row font-medium text-[color:var(--kb-ember)]">
              All your events
            </Link>
          </div>
        </section>

        <section aria-labelledby="g-signin">
          <h2 id="g-signin" className="kb-group-title">
            Signing in
          </h2>
          <div className="kb-group">
            <div className="kb-row">
              <span className="flex min-w-0 flex-1 flex-col">
                <span>Email code</span>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">We email a code each time. Always available.</span>
              </span>
              <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">On</span>
            </div>
            <PasswordForm hasPassword={hasPassword} />
          </div>
        </section>

        <section aria-label="Session" className="flex flex-col gap-1">
          <form action="/api/auth/signout" method="post">
            <input type="hidden" name="scope" value="global" />
            <button type="submit" className="btn btn-secondary !min-h-[52px] w-full !text-[16px]">
              Sign out everywhere
            </button>
          </form>
          <DeleteAccount handOver={deletion.handOver} closes={deletion.closes} />
          <p className="m-0 mt-2 text-center text-[14px] leading-normal text-[color:var(--kb-ink-3)]">
            To keep everything shared with you, open each album and use Save to Photos (on a computer, Download album).{" "}
            <Link href="/support">Need help?</Link>
          </p>
        </section>
      </div>

      {tabEvent ? <MemberTabBar handle={tabEvent.handle} facesEnabled={tabEvent.facesEnabled} /> : null}
    </main>
  );
}

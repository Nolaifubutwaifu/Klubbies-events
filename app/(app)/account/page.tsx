/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { EventMark } from "@/components/EventMark";
import { MemberTabBar } from "@/components/MemberTabBar";
import { SimpleHeader } from "@/components/SimpleHeader";
import { planAccountDeletion } from "@/lib/account/delete";
import { getProfile, getSessionUser, listMyEvents, requireUser } from "@/lib/auth/session";
import { formatEventDates, formatLongDate } from "@/lib/format";
import { SIGNED_URL_TTL, signLogoMarks, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { AvatarUploader, NotificationToggles, PasswordForm, ProfileForm } from "./AccountForms";
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
      <SimpleHeader name={name} avatarUrl={avatarUrl} />

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-full border border-[color:var(--kb-line)] bg-[color:var(--kb-sand)] text-[18px] font-semibold">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,4vw,30px)] font-semibold tracking-[-0.02em]">{name}</h1>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
              {profile.email} · since {formatLongDate(profile.created_at)}
            </p>
          </div>
        </div>

        <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <section className="flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold">Your events</h2>
            {events.length ? (
              <div className="soft-card flex flex-col">
                {events.map((event, index) => (
                  <div
                    key={event.membershipId}
                    className={`flex flex-wrap items-center gap-3 p-3.5 ${index > 0 ? "border-t border-[color:var(--kb-line)]" : ""}`}
                  >
                    <Link href={`/e/${event.handle}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline">
                      <EventMark
                        name={event.name}
                        logoUrl={event.logoPath ? signed.get(event.logoPath) : null}
                        accentColour={event.accentColour}
                        size={36}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{event.name}</span>
                        <span className="block text-[14px] text-[color:var(--ink-70)]">
                          {[event.roleName, formatEventDates(event.startsOn, event.endsOn)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                    {/* On a phone this page is the "You" tab, and the tab bar
                        has no organiser entry, so organisers get it here. */}
                    {event.isAdmin ? (
                      <Link href={`/admin/${event.handle}`} className="btn btn-sm btn-secondary no-underline">
                        Organise
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                No events yet. Open the link or QR code an organiser shared to join one.
              </p>
            )}

            <FaceRow events={events} />

            <h2 className="mt-2 text-[16px] font-semibold">Notifications</h2>
            <div className="soft-card p-4">
              <PhoneNotifications />
              <NotificationToggles
                initial={{
                  notify_new_album: profile.notify_new_album,
                  notify_access_ending: profile.notify_access_ending,
                }}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold">You</h2>
            <div className="soft-card flex flex-col gap-6 p-5">
              <AvatarUploader userId={user.id} avatarUrl={avatarUrl} />
              <ProfileForm displayName={profile.display_name ?? ""} email={profile.email} bio={profile.bio} />
            </div>

            <h2 className="mt-2 text-[16px] font-semibold">Signing in</h2>
            <div className="soft-card flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[14px]">
                  <strong className="font-medium">Email code</strong>
                  <br />
                  <span className="text-[14px] text-[color:var(--ink-70)]">We email a code each time. Always available.</span>
                </span>
                <span className="soft-chip">On</span>
              </div>
              <PasswordForm hasPassword={hasPassword} />
            </div>

            <p className="m-0 text-[14px] leading-normal text-[color:var(--ink-70)]">
              For a copy of everything shared with you, use Download in each album, or{" "}
              <Link href="/support" className="kb-link">
                contact us
              </Link>
              .
            </p>
            <DeleteAccount handOver={deletion.handOver} closes={deletion.closes} />
          </section>
        </div>
      </div>

      {tabEvent ? <MemberTabBar handle={tabEvent.handle} facesEnabled={tabEvent.facesEnabled} /> : null}
    </main>
  );
}

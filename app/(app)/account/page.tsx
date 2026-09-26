/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { ClubMark } from "@/components/ClubMark";
import { Brand } from "@/components/ui";
import { InviteCard } from "@/components/InviteCard";
import { MemberTabBar } from "@/components/MemberTabBar";
import { getProfile, getSessionUser, listMyClubs, requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/format";
import { SIGNED_URL_TTL, signLogoMarks, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { AvatarUploader, NotificationToggles, PasswordForm, ProfileForm } from "./AccountForms";
import { FaceRow } from "./FaceRow";

export const metadata: Metadata = { title: "Your profile" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default async function AccountPage() {
  await requireUser("/account");
  const [profile, user, { clubs, invites }] = await Promise.all([getProfile(), getSessionUser(), listMyClubs()]);
  if (!profile || !user) return null;

  const supabase = await createClient();
  const [avatar, signed] = await Promise.all([
    profile.avatar_url ? signPaths(supabase, [profile.avatar_url], SIGNED_URL_TTL.display) : new Map<string, string>(),
    signLogoMarks(supabase, clubs.map((club) => club.logoPath)),
  ]);
  const avatarUrl = profile.avatar_url ? (avatar.get(profile.avatar_url) ?? null) : null;
  // Set when the member saves a password from this page.
  const hasPassword = user.user_metadata?.has_password === true;
  const name = profile.display_name ?? profile.email;
  const leaving = clubs.filter((club) => club.status === "grace" && club.graceEndsAt);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[color:var(--kb-line)] px-4 py-3 sm:px-6">
        <Brand href="/clubs" size={24} />
        <AccountMenu name={name} avatarUrl={avatarUrl} />
      </header>

      <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-[64px] w-[64px] flex-none items-center justify-center overflow-hidden rounded-full bg-[color:var(--tone-support)] text-[20px] font-extrabold text-[color:var(--tone-support-ink)]">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
          </span>
          <div className="min-w-0">
            <h1 className="soft-display text-[clamp(24px,4vw,32px)]">{name}</h1>
            <p className="text-[14px] text-[color:var(--ink-70)]">
              {profile.email} · on Klubbies since {formatLongDate(profile.created_at)}
            </p>
          </div>
        </div>

        {leaving.map((club) => (
          <div
            key={club.membershipId}
            className="flex flex-wrap items-center gap-3 rounded-[var(--soft-r)] bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))] p-4 text-accent-800"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
            <span className="min-w-0 flex-1 text-[14px]">
              <strong className="font-bold">
                {club.name} access ends {formatLongDate(club.graceEndsAt)}.
              </strong>{" "}
              Download anything you want to keep before then.
            </span>
            <Link href={`/c/${club.handle}`} className="soft-btn soft-btn-tonal !min-h-[38px] !px-4 !text-[14px] no-underline">
              Open it
            </Link>
          </div>
        ))}

        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <section className="flex flex-col gap-4">
            <h2 className="soft-display text-[18px]">Your clubs</h2>
            {clubs.length ? (
              <div className="flex flex-col gap-2.5">
                {clubs.map((club) => (
                  <div key={club.membershipId} className="soft-card flex flex-col gap-2.5 p-3.5">
                    <Link href={`/c/${club.handle}`} className="flex items-center gap-3 text-ink no-underline">
                      <ClubMark
                        name={club.name}
                        logoUrl={club.logoPath ? signed.get(club.logoPath) : null}
                        accentColour={club.accentColour}
                        size={38}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">{club.name}</span>
                        <span className="block text-[14px] text-[color:var(--ink-70)]">
                          {club.roleName} · joined {formatLongDate(club.since)}
                        </span>
                      </span>
                      {club.status === "grace" && club.graceEndsAt ? (
                        <span className="soft-chip flex-none">{daysLeft(club.graceEndsAt)} days left</span>
                      ) : (
                        <span
                          className="flex-none rounded-full px-2.5 py-1 text-[14px] font-bold"
                          style={{ background: "#eaf5ea", color: "#2f6b36" }}
                        >
                          Active
                        </span>
                      )}
                    </Link>
                    {/* On a phone this page is the "You" tab and the tab bar
                        has no committee entry, so admins get their way in here. */}
                    {club.isAdmin ? (
                      <Link
                        href={`/admin/${club.handle}`}
                        className="soft-btn soft-btn-tonal !min-h-[40px] self-start !px-4 !text-[14px] no-underline"
                      >
                        Admin view
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                You&apos;re not in a club yet. Ask a committee to add {profile.email} to their member list.
              </p>
            )}
            {invites.map((invite) => (
              <InviteCard key={invite.membershipId} invite={invite} />
            ))}

            <FaceRow clubs={clubs} />

            <h2 className="soft-display mt-2 text-[18px]">Notifications</h2>
            <div className="soft-card p-4">
              <NotificationToggles
                initial={{
                  notify_new_album: profile.notify_new_album,
                  notify_feed_post: profile.notify_feed_post,
                  notify_access_ending: profile.notify_access_ending,
                }}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="soft-display text-[18px]">You</h2>
            <div className="soft-card flex flex-col gap-6 p-5">
              <AvatarUploader userId={user.id} avatarUrl={avatarUrl} />
              <ProfileForm displayName={profile.display_name ?? ""} email={profile.email} bio={profile.bio} />
            </div>

            <h2 className="soft-display mt-2 text-[18px]">Signing in</h2>
            <div className="soft-card flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[14px]">
                  <strong>Email code</strong>
                  <br />
                  <span className="text-[14px] text-[color:var(--ink-70)]">We email a code each time. Always available.</span>
                </span>
                <span className="soft-chip">On</span>
              </div>
              <PasswordForm hasPassword={hasPassword} />
            </div>

            <p className="m-0 text-[14px] leading-normal text-[color:var(--ink-70)]">
              To delete your account or get a copy of everything shared with you, ask your club admin or contact us. We
              reply within a few days.
            </p>
          </section>
        </div>
      </div>

      {clubs[0] ? <MemberTabBar handle={clubs[0].handle} /> : null}
    </main>
  );
}

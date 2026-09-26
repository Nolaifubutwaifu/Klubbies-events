"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClubMark, clubInitials as initials } from "@/components/ClubMark";
import type { MyClub } from "@/lib/auth/session";

/**
 * The member app on a wide screen: every club you're in down the left, so
 * switching is one click and you can always see where you are. The phone gets
 * the tab bar instead.
 */
export function MemberSidebar({
  handle,
  clubs,
  savedCount,
  newCount,
  facesCount,
  canManage,
  logoUrls,
  person,
}: {
  handle: string;
  clubs: MyClub[];
  savedCount: number;
  newCount: number;
  /** Signed URLs for club logos, by club id. A club without one falls back
      to its initials, which is what every club used to get. */
  logoUrls: Record<string, string>;
  /** Shows the way into the committee screens. The header carries this on a
      phone, and the header is hidden at lg — so without it a manager on a
      wide screen has no route to their own admin area at all. */
  canManage: boolean;
  /** Null when this club has face recognition off, so the row is hidden. */
  facesCount: number | null;
  person: { name: string; role: string; avatarUrl: string | null };
}) {
  const pathname = usePathname();
  const base = `/c/${handle}`;
  // The lightbox owns the whole window: a cream rail beside a near-black photo
  // is the one place this layout fights the content.
  const inLightbox = /^\/c\/[^/]+\/a\/[^/]+\/[^/]+/.test(pathname);

  const rows = [
    ...(facesCount === null
      ? []
      : [
          {
            href: `${base}/me`,
            label: "Photos of you",
            badge: facesCount,
            active: pathname.startsWith(`${base}/me`),
          },
        ]),
    { href: `${base}/saved`, label: "Saved", badge: savedCount, active: pathname.startsWith(`${base}/saved`) },
    { href: `${base}/feed`, label: "Club feed", badge: 0, active: pathname.startsWith(`${base}/feed`) },
    { href: "/account", label: "Your profile", badge: 0, active: pathname.startsWith("/account") },
  ];

  if (inLightbox) return null;

  return (
    <aside className="hidden w-[236px] flex-none lg:sticky lg:top-5 lg:block lg:self-start">
      <div className="soft-card flex flex-col gap-1 p-3">
        <Link href="/clubs" className="soft-wordmark px-2 pb-3 pt-1 text-[20px] text-ink no-underline">
          klubbies
        </Link>

        <span className="px-2 pb-1 text-[14px] font-extrabold tracking-[0.1em] text-[color:var(--ink-55)]">
          YOUR CLUBS
        </span>
        {clubs.map((club) => {
          const here = club.handle === handle;
          return (
            <Link
              key={club.clubId}
              href={`/c/${club.handle}`}
              aria-label={here && newCount > 0 ? `${club.name}, ${newCount} new since your last visit` : club.name}
              aria-current={here && pathname === `/c/${club.handle}` ? "page" : undefined}
              className="flex min-h-[44px] items-center gap-2.5 rounded-full px-2.5 text-[14px] font-bold no-underline transition-colors"
              style={{
                background: here ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
                color: here ? "var(--color-accent-700)" : "var(--color-text)",
              }}
            >
              <ClubMark name={club.name} logoUrl={logoUrls[club.clubId]} accentColour={club.accentColour} />
              <span className="min-w-0 flex-1 truncate">{club.name}</span>
              {here && newCount > 0 ? (
                <span className="flex-none rounded-full bg-accent px-2 py-0.5 text-[14px] font-extrabold text-white">
                  {newCount}
                </span>
              ) : null}
            </Link>
          );
        })}

        <span className="my-2 h-px bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]" aria-hidden />

        {canManage ? (
          <Link
            href={`/admin/${handle}`}
            className="flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-[14px] font-bold no-underline transition-colors"
            style={{
              background: pathname.startsWith("/admin") ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
              color: pathname.startsWith("/admin") ? "var(--color-accent-700)" : "var(--color-text)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3 4 6.5v5c0 4.4 3.2 8.4 8 9.5 4.8-1.1 8-5.1 8-9.5v-5z" />
            </svg>
            Admin view
          </Link>
        ) : null}
        {rows.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            aria-current={row.active ? "page" : undefined}
            className="flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-[14px] font-bold no-underline transition-colors"
            style={{
              background: row.active ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
              color: row.active ? "var(--color-accent-700)" : "var(--color-text)",
            }}
          >
            {row.label}
            {row.badge > 0 ? (
              <span className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] px-2 py-0.5 text-[14px] font-extrabold text-[color:var(--color-neutral-700)]">
                {row.badge.toLocaleString("en-AU")}
              </span>
            ) : null}
          </Link>
        ))}

        <div className="mt-3 flex items-center gap-2.5 border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] px-1.5 pt-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-[color:var(--tone-support)] text-[14px] font-extrabold text-[color:var(--tone-support-ink)]">
            {person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(person.name)
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{person.name}</span>
            <span className="block truncate text-[14px] text-[color:var(--ink-55)]">{person.role}</span>
          </span>
        </div>
        <form action="/api/auth/signout" method="post" className="px-1.5 pt-1">
          <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-bold text-[color:var(--ink-55)]">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

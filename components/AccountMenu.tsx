"use client";

import { MoreLink, MoreMenu, MoreSeparator } from "@/components/MoreMenu";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * You, in the corner of every app screen: profile, clubs and signing out
 * live here, so no screen spends a button on them.
 */
export function AccountMenu({ name, avatarUrl = null }: { name: string; avatarUrl?: string | null }) {
  return (
    <MoreMenu
      label={`Your account, ${name}`}
      triggerClassName="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full border-0 bg-[color:var(--tone-support)] text-[14px] font-bold text-[color:var(--tone-support-ink)] cursor-pointer"
      trigger={
        avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )
      }
    >
      <span className="block px-3.5 pb-1 pt-2 text-[14px] font-bold text-[color:var(--kb-ink-2)]">{name}</span>
      <MoreLink href="/account">Your profile</MoreLink>
      <MoreLink href="/clubs">Your clubs</MoreLink>
      <MoreLink href="/admin/new">Start another club</MoreLink>
      <MoreSeparator />
      <form action="/api/auth/signout" method="post">
        <button type="submit" role="menuitem" className="kb-menu-item">
          Sign out
        </button>
      </form>
      <form action="/api/auth/signout" method="post">
        <input type="hidden" name="scope" value="global" />
        <button type="submit" role="menuitem" className="kb-menu-item">
          Sign out of all devices
        </button>
      </form>
    </MoreMenu>
  );
}

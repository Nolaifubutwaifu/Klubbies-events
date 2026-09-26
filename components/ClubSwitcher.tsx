"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { acceptInviteAction, declineInviteAction } from "@/app/(app)/actions";
import { ClubMark } from "@/components/ClubMark";
import type { MyClub } from "@/lib/auth/session";

export function ClubSwitcher({
  current,
  clubs,
  invites,
  logoUrl,
  clubLogoUrls = {},
  shortcuts = [],
}: {
  current: { name: string; handle: string; accentColour?: string | null } | null;
  clubs: MyClub[];
  invites: MyClub[];
  logoUrl?: string | null;
  /** Signed logo per club id, so the list matches the button above it. */
  clubLogoUrls?: Record<string, string>;
  /** Places in the current club that only the desktop rail links to. */
  shortcuts?: { href: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = clubs.filter((c) => c.handle !== current?.handle);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border-0 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-3 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ClubMark name={current?.name ?? "Klubbies"} logoUrl={logoUrl} accentColour={current?.accentColour} size={24} />
        <span className="soft-wordmark text-[17px]">{current?.name ?? "Your clubs"}</span>
        {invites.length ? <span className="tag tag-accent text-[14px]">{invites.length} new</span> : null}
        <span className="text-[14px] text-ink-55">▾</span>
      </button>

      {open ? (
        <div
          className="soft-card absolute left-0 top-[calc(100%+8px)] z-40 w-[320px] max-w-[92vw] overflow-hidden !p-0"
          role="menu"
        >
          <div className="label-caps px-4 pt-3">Your clubs</div>
          <div className="flex flex-col">
            {others.length === 0 && clubs.length <= 1 ? (
              <p className="px-4 py-3 text-[14px] text-ink-70">
                You&apos;re only in this club. Ask another committee to add your email, or start your own.
              </p>
            ) : null}
            {clubs.map((club) => (
              <Link
                key={club.membershipId}
                href={`/c/${club.handle}`}
                className="flex items-center gap-3 border-t border-divider px-4 py-3 text-ink no-underline hover:bg-accent-100"
                onClick={() => setOpen(false)}
                aria-current={club.handle === current?.handle}
              >
                <ClubMark name={club.name} logoUrl={clubLogoUrls[club.clubId]} accentColour={club.accentColour} />
                <span className="min-w-0">
                  <span className="block truncate font-heading text-[15px] font-bold">{club.name}</span>
                  <span className="block text-[14px] text-ink-70">
                    {club.roleName}
                    {club.status === "grace" ? " · access ending" : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {current && shortcuts.length ? (
            <div className="flex flex-col border-t-2 border-divider">
              <div className="label-caps px-4 pt-3">In {current.name}</div>
              {shortcuts.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-[48px] items-center border-t border-divider px-4 text-[15px] font-bold text-ink no-underline first-of-type:border-t-0 hover:bg-accent-100"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          {invites.map((invite) => (
            <div key={invite.membershipId} className="m-3 border-2 border-accent bg-accent-100 p-3">
              <p className="text-[14px] text-accent-800">
                <strong>{invite.name}</strong> added you to their member list.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-[14px]"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await acceptInviteAction(invite.membershipId);
                      if (res.ok) {
                        setOpen(false);
                        router.push(`/c/${invite.handle}`);
                        router.refresh();
                      }
                    })
                  }
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-[14px]"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await declineInviteAction(invite.membershipId);
                      router.refresh();
                    })
                  }
                >
                  Not me
                </button>
              </div>
            </div>
          ))}

          <div className="border-t-2 border-divider p-3">
            <Link href="/admin/new" className="btn btn-secondary w-full justify-center text-[14px]" onClick={() => setOpen(false)}>
              Start another club
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

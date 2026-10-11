"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The attendee sections, inline in the header on wide screens. */
export function HeaderNav({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="ml-6 hidden items-center gap-6 md:flex">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href || pathname.startsWith(`${link.href}/a/`) : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className="relative flex h-16 items-center px-1.5 text-[15px] font-medium no-underline transition-colors hover:!text-[color:var(--kb-ink)]"
            style={{ color: active ? "var(--kb-ink)" : "var(--kb-ink-2)" }}
          >
            {link.label}
            {active ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[color:var(--kb-ember)]" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The attendee sections, inline in the header on wide screens. */
export function HeaderNav({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href || pathname.startsWith(`${link.href}/a/`) : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className="relative flex h-[60px] items-center px-3 text-[14px] font-medium no-underline transition-colors"
            style={{ color: active ? "var(--kb-ink)" : "var(--kb-ink-3)" }}
          >
            {link.label}
            {active ? <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[color:var(--kb-ember)]" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

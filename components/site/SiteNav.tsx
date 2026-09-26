"use client";

import Link from "next/link";
import { Brand } from "@/components/ui";
import { PRICE } from "@/lib/copy/site";
import { useEffect, useRef, useState } from "react";

export type SiteSection = "how" | "pricing" | "privacy" | null;

const LINKS: { key: Exclude<SiteSection, null>; href: string; label: string }[] = [
  { key: "how", href: "/#how", label: "How it works" },
  { key: "pricing", href: "/#pricing", label: "Pricing" },
  { key: "privacy", href: "/privacy", label: "Privacy" },
];

/**
 * The one nav for Home, How it works and the legal pages. Below 640px it is
 * the logo, a plain Log in link and a menu button: nothing can wrap.
 */
export function SiteNav({ current = null }: { current?: SiteSection }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        return;
      }
      // Keep Tab inside the sheet while it is open.
      if (ev.key !== "Tab" || !sheet.current) return;
      const items = Array.from(sheet.current.querySelectorAll<HTMLElement>("a, button"));
      const first = items[0];
      const last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
      <div className="kb-wrap flex h-16 items-center gap-3 sm:h-20">
        <Brand />

        <nav aria-label="Main" className="ml-auto hidden items-center gap-7 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current === link.key ? "page" : undefined}
              className={`flex min-h-[44px] items-center whitespace-nowrap text-[15px] no-underline ${
                current === link.key
                  ? "font-medium text-[color:var(--kb-ink)] underline decoration-[color:var(--kb-ember)] decoration-2 underline-offset-[8px]"
                  : "font-medium text-[color:var(--kb-ink-2)] hover:text-[color:var(--kb-ink)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <span className="flex items-center gap-3">
            <Link href="/signin" className="btn btn-secondary no-underline">
              Sign in
            </Link>
            <Link href="/start" className="btn btn-primary no-underline">
              Create an event
            </Link>
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <Link href="/signin" className="flex min-h-[44px] items-center px-2 text-[15px] font-medium text-[color:var(--kb-ink)] no-underline">
            Sign in
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="kb-icon-btn"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div
          ref={sheet}
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-[color:var(--kb-white)] sm:hidden"
        >
          <div className="kb-wrap flex h-16 flex-none items-center">
            <span onClick={() => setOpen(false)}>
              <Brand />
            </span>
            <button type="button" className="kb-icon-btn ml-auto" aria-label="Close menu" onClick={() => setOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <nav aria-label="Main" className="kb-wrap mt-4 flex flex-col">
            {[...LINKS, { key: "faq", href: "/#questions", label: "Questions" }].map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={current === link.key ? "page" : undefined}
                className="flex min-h-[68px] items-center border-b border-[color:var(--kb-line)] serif text-[32px] text-[color:var(--kb-ink)] no-underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="kb-wrap mt-auto flex flex-col gap-3 pb-[max(24px,env(safe-area-inset-bottom))]">
            <Link href="/start" className="btn btn-primary !min-h-[54px] w-full" onClick={() => setOpen(false)}>
              Create an event
            </Link>
            <Link href="/signin" className="btn btn-secondary !min-h-[54px] w-full" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <p className="text-center text-[14px] text-[color:var(--kb-ink-3)]">{PRICE.line}. No subscription.</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}

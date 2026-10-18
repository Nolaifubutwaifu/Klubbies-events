"use client";

import Link from "next/link";
import { Brand } from "@/components/ui";
import { PRICE } from "@/lib/copy/site";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SiteSection = "how" | "features" | "pricing" | "faq" | "privacy" | null;

const LINKS: { key: Exclude<SiteSection, null>; href: string; label: string }[] = [
  { key: "how", href: "/how-it-works", label: "How it works" },
  { key: "features", href: "/features", label: "Features" },
  { key: "pricing", href: "/pricing", label: "Pricing" },
  { key: "faq", href: "/faq", label: "FAQ" },
];

/**
 * The one nav for Home, Features, Pricing, FAQ and the legal pages: sticky, on
 * paper. Below 1024px the links fold into the Menu sheet, and below 640px
 * Create an event goes too; Sign in stays, so a phone can always sign in.
 */
export function SiteNav({ current = null, inApp = false }: { current?: SiteSection; inApp?: boolean }) {
  const links = inApp ? LINKS.filter((link) => link.key !== "pricing") : LINKS;
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
    <header className="sticky top-0 z-40 border-b border-[color:var(--kb-line)] bg-[rgb(247_247_245/0.94)] backdrop-blur-[6px]">
      <div className="kb-wrap flex h-16 items-center justify-between gap-3 sm:h-[72px] sm:gap-6">
        <Brand size={18} />

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current === link.key ? "page" : undefined}
              className={`flex min-h-[44px] items-center whitespace-nowrap px-1.5 text-[15px] font-medium no-underline ${
                current === link.key
                  ? "text-[color:var(--kb-ink)] shadow-[inset_0_-2px_0_var(--kb-brand)]"
                  : "text-[color:var(--kb-ink-2)] hover:text-[color:var(--kb-ink)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-none items-center gap-2">
          <Link href="/signin" className="btn btn-quiet no-underline max-sm:!px-3">
            Sign in
          </Link>
          <Link href="/start" className="btn btn-primary hidden no-underline sm:inline-flex">
            Create an event
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="btn btn-secondary max-sm:!w-11 max-sm:!px-0 lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            {/* Next to Sign in on a phone there's room for the icon only. */}
            <span className="max-sm:hidden">Menu</span>
          </button>
        </div>
      </div>

      {/* On the page, not in the header: the header's blur makes it the
          containing box for anything fixed inside it, which squeezed the
          full-screen menu into a 64px strip. */}
      {open
        ? createPortal(
            <div
              ref={sheet}
              id="site-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="theme-soft kb-branded fixed inset-0 z-50 flex flex-col bg-[color:var(--kb-white)] lg:hidden"
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
                {[...links, { key: "privacy", href: "/privacy", label: "Privacy" }].map((link) => (
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
                {inApp ? null : <p className="text-center text-[14px] text-[color:var(--kb-ink-3)]">{PRICE.line}. No subscription.</p>}
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}

"use client";

import { useRouter } from "next/navigation";

/**
 * Back to the previous screen, the way the phone's own Back would go. Opened
 * fresh (a new tab, a link from an email) there is nothing to go back to, so
 * it goes to `fallback` instead.
 */
export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      aria-label={label}
      className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-[8px] text-[color:var(--kb-ink)] hover:bg-[color:var(--kb-sand)]"
      onClick={(ev) => {
        if (window.history.length <= 1) return;
        ev.preventDefault();
        router.back();
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </a>
  );
}

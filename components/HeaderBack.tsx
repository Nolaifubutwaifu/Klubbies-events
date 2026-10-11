"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Inside an album, the event bar starts with Back to the event's albums. */
export function HeaderBack({ handle }: { handle: string }) {
  const pathname = usePathname();
  if (!new RegExp(`^/e/${handle}/a/[^/]+/?$`, "i").test(pathname)) return null;
  return (
    <Link href={`/e/${handle}`} aria-label="Back to albums" className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-[8px] text-[color:var(--kb-ink)] hover:bg-[color:var(--kb-sand)]">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}

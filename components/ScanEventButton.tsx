"use client";

import { useSyncExternalStore } from "react";
import { nativeScanner } from "@/lib/native-app";

const subscribeNever = () => () => {};

/**
 * "Scan the event's QR code", inside the iPhone app only: it opens the native
 * scanner, which lands on the event's join screen. In a browser the phone's
 * own camera app already does this, so nothing is shown.
 */
export function ScanEventButton({ className = "btn btn-secondary w-full" }: { className?: string }) {
  const available = useSyncExternalStore(subscribeNever, () => Boolean(nativeScanner()), () => false);
  if (!available) return null;
  return (
    <button type="button" className={className} onClick={() => nativeScanner()?.postMessage({})}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
        <path d="M9 9h2v2H9zM13 13h2v2h-2zM13 9h2M9 13v2" />
      </svg>
      Scan the event&apos;s QR code
    </button>
  );
}

"use client";

import Link from "next/link";
import { FaceIcon } from "@/components/soft/icons";
import { useState, useSyncExternalStore } from "react";

/**
 * The invitation to enrol. A dismissible banner, never a modal on first load:
 * the one thing a biometric feature must not do is ambush someone with a
 * decision before they have looked around.
 *
 * Dismissal is per club and lives in localStorage — losing it on a new device
 * costs one more banner, which is cheaper than a row in the database.
 */
function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "dismissed";
  } catch {
    // Private browsing. The banner comes back next time, which is fine.
    return false;
  }
}

export function FacePrompt({ clubId, href, count }: { clubId: string; href: string; count: number }) {
  const key = `kb_face_prompt_${clubId}`;
  // localStorage is an external store, and reading it during render would
  // mismatch the server, so it is read after hydration. The banner is hidden
  // on the server pass, which is also what we want: no flash of a prompt the
  // member already dismissed.
  const storedDismissed = useSyncExternalStore(
    () => () => {},
    () => readDismissed(key),
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);

  if (storedDismissed || dismissed) return null;

  return (
    <div className="kb-info mx-4 mb-4 flex-wrap items-center gap-3 sm:mx-6">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white text-[color:var(--kb-ember-deep)]" aria-hidden>
        <FaceIcon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block font-bold">Find yourself in this club&rsquo;s photos</strong>
        <span className="text-[15px] text-[color:var(--kb-ink-2)]">
          {count > 0
            ? `${count.toLocaleString("en-AU")} already waiting. Only you can see them.`
            : "Add a selfie and we’ll show you the ones you’re in. Only you can see them."}
        </span>
      </span>
      <Link href={href} className="btn btn-primary btn-sm">
        {count > 0 ? "Show me" : "Set it up"}
      </Link>
      <button
        type="button"
        className="kb-link kb-link-quiet !no-underline"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(key, "dismissed");
          } catch {
            // Private browsing: the banner comes back next time, which is fine.
          }
        }}
      >
        Not now
      </button>
    </div>
  );
}

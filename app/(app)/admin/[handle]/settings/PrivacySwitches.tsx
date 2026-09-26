"use client";

import { useState, useTransition } from "react";
import { setEventPrivacyAction } from "@/app/(app)/admin/actions";

type Prefs = { allow_removal_requests: boolean };

/** Saves on toggle: nobody wants a Save button under one switch. */
export function PrivacySwitches({ eventId, initial }: { eventId: string; initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="soft-card overflow-hidden">
      <label className="flex cursor-pointer items-center gap-3 p-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Attendees can ask for a photo to come down</span>
          <span className="block text-[14px] text-[color:var(--ink-70)]">
            The photo hides straight away; you confirm or restore it within seven days.
          </span>
        </span>
        <input
          type="checkbox"
          checked={prefs.allow_removal_requests}
          disabled={pending}
          onChange={(e) => {
            const next = { allow_removal_requests: e.target.checked };
            setPrefs(next);
            startTransition(async () => {
              const res = await setEventPrivacyAction(eventId, next);
              setMessage(res.error ?? "Saved");
            });
          }}
        />
      </label>
      {message ? (
        <span className="block border-t border-[color:var(--kb-line)] px-4 py-2 text-[14px] text-[color:var(--ink-55)]">{message}</span>
      ) : null}
    </div>
  );
}

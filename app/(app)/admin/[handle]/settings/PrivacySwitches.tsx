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
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span id="removal-switch" className="block text-[15px] font-medium">Attendees can ask for a photo to come down</span>
          <span className="block text-[14px] text-[color:var(--ink-70)]">
            The photo hides straight away; you confirm or restore it within seven days.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.allow_removal_requests}
          aria-labelledby="removal-switch"
          className="kb-switch"
          disabled={pending}
          onClick={() => {
            const next = { allow_removal_requests: !prefs.allow_removal_requests };
            setPrefs(next);
            startTransition(async () => {
              const res = await setEventPrivacyAction(eventId, next);
              setMessage(res.error ?? "Saved");
            });
          }}
        />
      </div>
      {message ? (
        <span className="pt-2 text-[14px] text-[color:var(--kb-ink-3)]" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

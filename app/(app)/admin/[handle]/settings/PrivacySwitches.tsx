"use client";

import { useState, useTransition } from "react";
import { setClubPrivacyAction } from "@/app/(app)/admin/actions";

type Prefs = { allow_removal_requests: boolean; grace_period_enabled: boolean };

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "allow_removal_requests",
    label: "Members can ask for a photo to come down",
    hint: "The photo hides straight away; you confirm within seven days.",
  },
  {
    key: "grace_period_enabled",
    label: "30 day wind-down when someone leaves",
    hint: "Off means access ends the moment you take them off the list.",
  },
];

/** Saves on each toggle — nobody wants a Save button under two switches. */
export function PrivacySwitches({ clubId, initial }: { clubId: string; initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="soft-card overflow-hidden">
      {ROWS.map((row, index) => (
        <label
          key={row.key}
          className={`flex cursor-pointer items-center gap-3 p-4 ${
            index > 0 ? "border-t border-[color-mix(in_srgb,var(--color-text)_7%,transparent)]" : ""
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">{row.label}</span>
            <span className="block text-[14px] text-[color:var(--ink-70)]">{row.hint}</span>
          </span>
          <input
            type="checkbox"
            checked={prefs[row.key]}
            disabled={pending}
            onChange={(e) => {
              const next = { ...prefs, [row.key]: e.target.checked };
              setPrefs(next);
              startTransition(async () => {
                const res = await setClubPrivacyAction(clubId, next);
                setMessage(res.error ?? "Saved");
              });
            }}
          />
        </label>
      ))}
      {message ? (
        <span className="block border-t border-[color-mix(in_srgb,var(--color-text)_7%,transparent)] px-4 py-2 text-[14px] text-[color:var(--ink-55)]">
          {message}
        </span>
      ) : null}
    </div>
  );
}

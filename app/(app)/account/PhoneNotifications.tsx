"use client";

import { useEffect, useState } from "react";
import { nativePush, pushAction, type PushState } from "@/lib/native-app";

/**
 * iPhone notifications, shown only inside the app. They follow the switches
 * below: whatever you get an email about, you also get a notification about.
 */
export function PhoneNotifications() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nativePush()) return;
    pushAction("status").then(setState).catch(() => undefined);
  }, []);

  if (!state) return null;

  const on = state.permission === "granted" || state.permission === "provisional";
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--kb-line)] pb-3 text-[14px]">
      <span>
        <strong className="font-medium">iPhone notifications</strong>
        <br />
        <span className="text-[color:var(--ink-70)]">
          {on
            ? "On. Everything ticked below also comes to this iPhone."
            : state.permission === "denied"
              ? "Off in iPhone Settings for Klubbies Events."
              : "Off. Turn on to get everything ticked below on this iPhone too."}
        </span>
      </span>
      {on ? (
        <span className="soft-chip">On</span>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const next = await pushAction(state.permission === "denied" ? "openSettings" : "enable").catch(() => null);
            if (next) setState(next);
            setBusy(false);
          }}
        >
          {state.permission === "denied" ? "Open Settings" : "Turn on"}
        </button>
      )}
    </div>
  );
}

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
    <div className="kb-row">
      <span className="flex min-w-0 flex-1 flex-col">
        <span>iPhone notifications</span>
        <span className="text-[14px] text-[color:var(--kb-ink-3)]">
          {on
            ? "On. Everything switched on below also comes to this iPhone."
            : state.permission === "denied"
              ? "Off in iPhone Settings for Klubbies Events."
              : "Off. Turn on to get everything below on this iPhone too."}
        </span>
      </span>
      {on ? (
        <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">On</span>
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

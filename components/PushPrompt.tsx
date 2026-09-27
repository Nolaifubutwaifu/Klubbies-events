"use client";

import { useEffect, useState } from "react";
import { nativePush, pushAction } from "@/lib/native-app";

const DISMISSED = "kb-push-prompt-dismissed";

/**
 * Inside the iPhone app, the first time someone opens an event and hasn't yet
 * been asked about notifications: one card, asked once. iOS only lets an app
 * ask once, so the card comes first and the system prompt follows a yes.
 */
export function PushPrompt({ eventName }: { eventName: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!nativePush()) return;
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // Storage blocked: ask anyway, it's one card.
    }
    pushAction("status")
      .then((state) => setShow(state?.permission === "notDetermined"))
      .catch(() => undefined);
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Nothing to remember it in; the card just comes back next time.
    }
  };

  return (
    <div className="kb-info mt-6 flex-wrap items-center justify-between gap-3">
      <span>Get a notification when {eventName} shares a new album?</span>
      <span className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={async () => {
            close();
            await pushAction("enable").catch(() => undefined);
          }}
        >
          Turn on
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={close}>
          Not now
        </button>
      </span>
    </div>
  );
}

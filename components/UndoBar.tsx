"use client";

import { useEffect, useRef, useState, useTransition } from "react";

export const UNDO_SECONDS = 10;

type Result = { ok?: boolean; error?: string; message?: string };

/**
 * "Deleted 12 photos. Undo" along the bottom of the screen for ten seconds
 * after a delete. Undo calls the matching restore action; after the ten
 * seconds the item is still in Recently deleted under Settings.
 */
export function UndoBar({
  message,
  onUndo,
  onDone,
}: {
  message: string;
  onUndo: () => Promise<Result>;
  /** Called when the bar goes away, restored or not. */
  onDone: (restored: boolean) => void;
}) {
  const [text, setText] = useState(message);
  const [finished, setFinished] = useState(false);
  const [pending, startTransition] = useTransition();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (finished || pending) return;
    const timer = setTimeout(() => done.current(false), UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [finished, pending]);

  const undo = () =>
    startTransition(async () => {
      const res = await onUndo();
      setFinished(true);
      setText(res.error ?? res.message ?? "Restored");
      setTimeout(() => done.current(Boolean(res.ok)), 2500);
    });

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[calc(100%-32px)] max-w-[520px] items-center justify-between gap-3 rounded-[10px] bg-ink px-4 py-2.5 text-[15px] text-white shadow-lg"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
    >
      <span className="min-w-0">{text}</span>
      {finished ? null : (
        <button
          type="button"
          onClick={undo}
          disabled={pending}
          className="min-h-[44px] shrink-0 rounded-[8px] px-3 font-semibold text-white underline underline-offset-2"
        >
          {pending ? "Restoring…" : "Undo"}
        </button>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { decideFaceMatchAction } from "@/app/(app)/face-actions";
import type { Suggestion } from "@/lib/faces/queries";

/**
 * The face, cropped on the server to a 240px square (see
 * /api/faces/[matchId]/crop). Every card is the same size whatever the
 * photo's shape, and it downloads a few kilobytes rather than the whole
 * 2000px display copy.
 */
function FaceCrop({ suggestion }: { suggestion: Suggestion }) {
  return (
    <span className="block aspect-square w-full overflow-hidden rounded-[16px] bg-[color:var(--tone-support)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- private, per-member crop */}
      <img
        src={`/api/faces/${suggestion.matchId}/crop`}
        alt={`A face in a photo from ${suggestion.albumTitle}`}
        width={240}
        height={240}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

export function Suggestions({
  handle,
  suggestions,
  total,
}: {
  handle: string;
  suggestions: Suggestion[];
  /** Every suggestion waiting, not just the ones on screen. */
  total: number;
}) {
  const [decided, decide] = useOptimistic<string[], string>([], (state, id) => [...state, id]);
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  // The last answer waits a few seconds before it's saved, so a mis-tap can
  // be undone. Undoing a saved "Yes" would leave a wrong reference face.
  const [held, setHeld] = useState<{ suggestion: Suggestion; verdict: "confirm" | "reject" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (suggestion: Suggestion, verdict: "confirm" | "reject") =>
    startTransition(async () => {
      setError("");
      decide(suggestion.matchId);
      for (const id of suggestion.matchIds) {
        const res = await decideFaceMatchAction(id, verdict).catch(() => ({ error: "offline" }));
        // The card comes back and this says why, instead of it reappearing
        // next visit with no explanation.
        if (res && "error" in res && res.error) {
          setError("Couldn't save that answer. Check your connection and try again.");
          return;
        }
      }
    });

  // The ref is the source of truth (timers and unmount read it); the state
  // only drives what's on screen.
  const heldRef = useRef(held);
  const hold = (next: typeof held) => {
    heldRef.current = next;
    setHeld(next);
  };

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const current = heldRef.current;
    hold(null);
    if (current) save(current.suggestion, current.verdict);
  };

  const answer = (suggestion: Suggestion, verdict: "confirm" | "reject") => {
    flush();
    hold({ suggestion, verdict });
    timer.current = setTimeout(flush, 6000);
  };

  // Leaving the page saves whatever is still held.
  useEffect(
    () => () => {
      const pending = heldRef.current;
      if (pending) for (const id of pending.suggestion.matchIds) void decideFaceMatchAction(id, pending.verdict).catch(() => undefined);
    },
    [],
  );

  const remaining = suggestions.filter((s) => !decided.includes(s.matchId) && s.matchId !== held?.suggestion.matchId);

  const undoBar = held ? (
    <p className="m-0 flex flex-wrap items-center gap-3 text-[14px]" role="status">
      {held.verdict === "confirm" ? "Marked as you." : "Marked as not you."}
      <button
        type="button"
        className="kb-link"
        onClick={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          hold(null);
        }}
      >
        Undo
      </button>
    </p>
  ) : null;

  if (remaining.length === 0) return held || error ? <section className="flex flex-col gap-2">{undoBar}{error ? <p className="kb-error m-0" role="alert">{error}</p> : null}</section> : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="soft-display text-[19px]">Is this you?</h2>
        <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
          Saying yes helps us recognise you next time. Saying no means we never suggest that photo again.
          {total > suggestions.length
            ? ` ${total.toLocaleString("en-AU")} waiting. Answer these and the next ones appear.`
            : ""}
        </p>
      </div>
      {undoBar}
      {error ? (
        <p className="kb-error m-0" role="alert">
          {error}
        </p>
      ) : null}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {remaining.map((suggestion) => (
          <div key={suggestion.matchId} className="soft-card flex w-[188px] flex-none flex-col gap-2 p-3">
            {suggestion.albumId ? (
              <Link href={`/e/${handle}/a/${suggestion.albumId}/${suggestion.mediaId}`} className="block">
                <FaceCrop suggestion={suggestion} />
              </Link>
            ) : (
              <FaceCrop suggestion={suggestion} />
            )}
            <span className="truncate text-[14px] text-[color:var(--ink-55)]">{suggestion.albumTitle}</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="btn btn-ghost flex-1 !px-2"
                onClick={() => answer(suggestion, "confirm")}
              >
                Yes
              </button>
              <button
                type="button"
                className="btn btn-ghost flex-1 !px-2"
                onClick={() => answer(suggestion, "reject")}
              >
                Not me
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

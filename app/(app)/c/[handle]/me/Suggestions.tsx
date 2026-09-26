"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
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
  const remaining = suggestions.filter((s) => !decided.includes(s.matchId));

  if (remaining.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="soft-display text-[19px]">Is this you?</h2>
        <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
          Saying yes helps us recognise you next time. Saying no means we never suggest that photo again.
          {total > suggestions.length
            ? ` ${total.toLocaleString("en-AU")} waiting — answer these and the next ones appear.`
            : ""}
        </p>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {remaining.map((suggestion) => (
          <div key={suggestion.matchId} className="soft-card flex w-[188px] flex-none flex-col gap-2 p-3">
            {suggestion.albumId ? (
              <Link href={`/c/${handle}/a/${suggestion.albumId}/${suggestion.mediaId}`} className="block">
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
                onClick={() =>
                  startTransition(async () => {
                    decide(suggestion.matchId);
                    for (const id of suggestion.matchIds) await decideFaceMatchAction(id, "confirm");
                  })
                }
              >
                Yes
              </button>
              <button
                type="button"
                className="btn btn-ghost flex-1 !px-2"
                onClick={() =>
                  startTransition(async () => {
                    decide(suggestion.matchId);
                    for (const id of suggestion.matchIds) await decideFaceMatchAction(id, "reject");
                  })
                }
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

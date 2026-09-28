"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { purgeEventNowAction, restoreEventAction } from "@/app/(app)/admin/actions";

export type DeletedEventRow = { id: string; name: string; restoreBy: string };

/** Events in Recently deleted that this person runs: restore, or delete now. */
export function DeletedEvents({ events }: { events: DeletedEventRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(res.error ?? res.message ?? "");
      setConfirming(null);
      if (res.ok) router.refresh();
    });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="deleted-events">
      <h2 id="deleted-events" className="text-[16px] font-semibold">
        Recently deleted
      </h2>
      <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--kb-line)] rounded-[10px] border border-[color:var(--kb-line)] bg-white p-0">
        {events.map((event) => (
          <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-medium">{event.name}</span>
              <span className="text-[14px] text-[color:var(--kb-ink-3)]">Deleted, restore until {event.restoreBy}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => restoreEventAction(event.id))}>
                Restore
              </button>
              {confirming === event.id ? (
                <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => run(() => purgeEventNowAction(event.id))}>
                  Delete for good
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirming(event.id)}>
                  Delete now
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {message ? (
        <p role="status" className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
          {message}
        </p>
      ) : null}
    </section>
  );
}

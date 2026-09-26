"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transferOwnershipAction } from "@/app/(app)/admin/actions";

export type HandoverCandidate = { membershipId: string; name: string; isAdmin: boolean };

/**
 * Handing the club to next year's committee. Ownership here means the admin
 * role plus the club's own record of who runs it — the outgoing owner keeps
 * their role, because stepping down should be a separate, deliberate act.
 */
export function Handover({
  clubId,
  clubName,
  ownerName,
  candidates,
}: {
  clubId: string;
  clubName: string;
  ownerName: string;
  candidates: HandoverCandidate[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = candidates.find((c) => c.membershipId === choice);

  return (
    <section className="soft-card flex flex-col gap-4 p-5">
      <div>
        <h2 className="soft-display text-[19px]">Hand over the club</h2>
        <p className="mt-1 max-w-[62ch] text-[14px] text-[color:var(--ink-70)]">
          Your club&rsquo;s history doesn&rsquo;t graduate with your media officer. Give next year&rsquo;s committee the
          admin role and {clubName} stays exactly where it is &mdash; every album, every member, nothing moved.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-[16px] border border-[color-mix(in_srgb,var(--color-text)_7%,transparent)] bg-[color:var(--color-bg)] p-3.5 text-[14px]">
        <span className="font-bold">{ownerName}</span>
        <span className="text-[color:var(--ink-55)]">runs it today</span>
      </div>

      {candidates.length === 0 ? (
        <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
          Nobody else has signed in yet. Once next year&rsquo;s committee is on the member list and has logged in, you can
          hand the club to them here.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-bold text-[color:var(--ink-70)]">Who takes over</span>
            <select
              value={choice}
              onChange={(e) => {
                setChoice(e.target.value);
                setConfirming(false);
              }}
              className="soft-input !max-w-[420px]"
            >
              <option value="">Pick a member&hellip;</option>
              {candidates.map((c) => (
                <option key={c.membershipId} value={c.membershipId}>
                  {c.name}
                  {c.isAdmin ? " — already an admin" : ""}
                </option>
              ))}
            </select>
          </label>

          {confirming && selected ? (
            <div className="soft-bordered flex flex-col gap-3 p-4">
              <p className="m-0 text-[14px]">
                <strong className="font-bold">{selected.name}</strong> gets the admin role and becomes the club&rsquo;s
                owner on record. You keep your own role, so you can still upload &mdash; change or remove it afterwards if
                you&rsquo;re stepping down.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="soft-btn soft-btn-tonal" onClick={() => setConfirming(false)} disabled={pending}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="soft-btn soft-btn-primary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await transferOwnershipAction(clubId, selected.membershipId);
                      setMessage(res.error ?? res.message ?? "");
                      if (res.ok) {
                        setConfirming(false);
                        setChoice("");
                        router.refresh();
                      }
                    })
                  }
                >
                  {pending ? "Handing over…" : `Hand ${clubName} to ${selected.name}`}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="soft-btn soft-btn-primary self-start"
              disabled={!choice || pending}
              onClick={() => setConfirming(true)}
            >
              Hand over the club
            </button>
          )}
        </>
      )}

      {message ? <p className="m-0 text-[14px] font-bold text-accent-700">{message}</p> : null}
    </section>
  );
}

"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { setClubCodeAction, setExpectedGuestsAction, type BillingFormState } from "../../billing-actions";

/** "About how many guests?", which picks out the size that fits. */
export function ExpectedGuestsForm({ eventId, expected }: { eventId: string; expected: number | null }) {
  const [state, action] = useActionState<BillingFormState, FormData>(setExpectedGuestsAction.bind(null, eventId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="kb-label">About how many guests?</span>
        <input
          name="expected"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          defaultValue={expected ?? ""}
          className="input w-[160px]"
          placeholder="e.g. 300"
        />
      </label>
      <SubmitButton className="btn btn-secondary" pendingText="Saving…">
        {expected ? "Update" : "Suggest a size"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** A campus club code switches the event to club prices until its first payment. */
export function ClubCodeForm({ eventId, code, campus }: { eventId: string; code: string | null; campus: string | null }) {
  const [state, action] = useActionState<BillingFormState, FormData>(setClubCodeAction.bind(null, eventId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="kb-label">Student club? Enter your campus club code</span>
        <input name="code" defaultValue={code ?? ""} className="input w-[220px] uppercase" autoComplete="off" placeholder="e.g. UQCLUBS" />
      </label>
      <SubmitButton className="btn btn-secondary" pendingText="Checking…">
        {code ? "Change" : "Apply"}
      </SubmitButton>
      {campus && !state.error && !state.message ? (
        <span className="text-[14px] text-[color:var(--kb-ink-2)]">Club prices applied ({campus})</span>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}

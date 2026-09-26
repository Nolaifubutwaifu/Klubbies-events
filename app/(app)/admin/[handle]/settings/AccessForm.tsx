"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { setEventAccessAction, type ActionState } from "../../actions";

/** Brisbane calendar day of an instant, for the date input. */
function brisbaneDay(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date(iso));
}

export function AccessForm({
  eventId,
  accessMode,
  accessEndsAt,
}: {
  eventId: string;
  accessMode: "link" | "guest_list";
  accessEndsAt: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setEventAccessAction.bind(null, eventId), {});
  const [mode, setMode] = useState(accessMode);
  const [closes, setCloses] = useState(Boolean(accessEndsAt));

  const options = [
    {
      value: "link" as const,
      title: "Anyone with the event link",
      body: "People confirm their email with a code, then they're in. Best for conferences and meetups.",
    },
    {
      value: "guest_list" as const,
      title: "Guest list only",
      body: "Only addresses on your list get a code. Best for private and invite-only events.",
    },
  ];

  return (
    <form action={action} className="soft-card flex flex-col gap-4 p-5">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[14px] font-medium">Who can get in</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--kb-r-card)] border p-3.5"
            style={{ borderColor: mode === option.value ? "var(--kb-ember)" : "var(--kb-line)" }}
          >
            <input
              type="radio"
              name="accessMode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[14px] font-medium">{option.title}</span>
              <span className="block text-[14px] text-[color:var(--ink-70)]">{option.body}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 text-[14px] font-medium">
          <input type="checkbox" checked={closes} onChange={(e) => setCloses(e.target.checked)} />
          Close the gallery to attendees on a date
        </label>
        {closes ? (
          <input
            className="input max-w-[220px]"
            type="date"
            name="accessEndsOn"
            defaultValue={brisbaneDay(accessEndsAt)}
            required
            aria-label="Gallery closes at the end of"
          />
        ) : (
          <input type="hidden" name="accessEndsOn" value="" />
        )}
        <span className="kb-help">
          Attendees can&apos;t open photos after the end of that day and get a reminder a week before. Organisers keep
          access. Photos are not deleted.
        </span>
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary self-start" pendingText="Saving…">
        Save access
      </SubmitButton>
    </form>
  );
}

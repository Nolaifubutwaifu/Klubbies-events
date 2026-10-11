"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { createAlbumAction, type ActionState } from "@/app/(app)/admin/actions";
import { isoToBrisbaneInput } from "@/lib/format";

/** Tomorrow at 9am: the usual "photos are ready" moment after an event. */
function tomorrowMorning(): string {
  // Tomorrow in Brisbane, where the server reads the time.
  return `${isoToBrisbaneInput(new Date(Date.now() + 24 * 3600 * 1000).toISOString()).slice(0, 10)}T09:00`;
}

export function NewAlbumPanel({
  eventId,
  defaultDate,
  autoFocus = true,
}: {
  eventId: string;
  defaultDate: string | null;
  /** Off when the event already has albums: the keyboard shouldn't jump up for a form they may not want. */
  autoFocus?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createAlbumAction.bind(null, eventId), {});
  const [when, setWhen] = useState<"now" | "later">("now");
  const [publishAt, setPublishAt] = useState(tomorrowMorning);

  const [download, setDownload] = useState(true);
  const [contribute, setContribute] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      <h2 className="text-[18px] font-semibold">New album</h2>

      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        Name
        <input className="input !min-h-[48px]" name="title" placeholder="Keynote, Networking drinks, Headshots" required maxLength={160} autoFocus={autoFocus} />
      </label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        <span className="flex justify-between">
          Date <span className="font-normal text-[color:var(--kb-ink-3)]">Optional</span>
        </span>
        <input className="input !min-h-[48px]" name="albumDate" type="date" defaultValue={defaultDate ?? ""} />
      </label>

      <div className="flex flex-col">
        {(
          [
            ["allowDownload", "on", "Attendees can download", "Originals, one by one or as a zip", download, setDownload],
            ["contributorScope", "members", "Attendees can add photos", "Good for a drinks album", contribute, setContribute],
          ] as const
        ).map(([name, value, label, hint, on, set]) => (
          <div key={name} className="flex items-center gap-3 border-t border-[color:var(--kb-sand)] py-3 first:border-t-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <span id={`${name}-label`} className="text-[15px] font-medium">
                {label}
              </span>
              <span className="text-[14px] text-[color:var(--kb-ink-3)]">{hint}</span>
            </span>
            <button type="button" role="switch" aria-checked={on} aria-labelledby={`${name}-label`} className="kb-switch" onClick={() => set(!on)} />
            {on ? <input type="hidden" name={name} value={value} /> : null}
          </div>
        ))}
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[15px] font-semibold">Publish</legend>
        <label className={`flex cursor-pointer items-start gap-3 rounded-[8px] border p-3 text-[15px] ${when === "now" ? "border-[color:var(--kb-brand)] bg-[color:var(--kb-brand-tint)]" : "border-[color:var(--kb-line)]"}`}>
          <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="mt-0.5" />
          <span className="flex flex-col">
            <span className="font-medium">When I publish it</span>
            <span className="text-[14px] text-[color:var(--kb-ink-3)]">Kept as a draft until you press Publish</span>
          </span>
        </label>
        <label className={`flex cursor-pointer items-start gap-3 rounded-[8px] border p-3 text-[15px] ${when === "later" ? "border-[color:var(--kb-brand)] bg-[color:var(--kb-brand-tint)]" : "border-[color:var(--kb-line)]"}`}>
          <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="mt-0.5" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-medium">At a time I choose</span>
            <input
              className="input !min-h-[44px]"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => {
                setPublishAt(e.target.value);
                setWhen("later");
              }}
              aria-label="Publish at"
            />
            <span className="text-[14px] text-[color:var(--kb-ink-3)]">It goes live within the hour, and attendees who asked are emailed.</span>
          </span>
        </label>
        <input type="hidden" name="publishAt" value={when === "later" ? publishAt : ""} />
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Making the album…">
        {when === "later" ? "Schedule and start uploading" : "Create and start uploading"}
      </SubmitButton>
    </form>
  );
}

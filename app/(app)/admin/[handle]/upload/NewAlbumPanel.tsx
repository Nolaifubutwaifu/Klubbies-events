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

  return (
    <form action={action} className="soft-card flex flex-col gap-5 p-5 sm:p-6">
      <h2 className="text-[18px] font-semibold">New album</h2>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="field">
          Album name
          <input className="input" name="title" placeholder="Keynote, Networking drinks, Headshots" required maxLength={160} autoFocus={autoFocus} />
        </label>
        <label className="field">
          Date (optional)
          <input className="input" name="albumDate" type="date" defaultValue={defaultDate ?? ""} />
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" name="allowDownload" defaultChecked />
          Attendees can download the originals
        </label>
        <label className="flex items-center gap-3 text-[14px]">
          <input
            type="checkbox"
            name="contributorScope"
            value="members"
          />
          Attendees can add their own photos to this album
        </label>
      </div>

      <fieldset className="m-0 flex flex-col gap-2.5 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] p-4">
        <legend className="px-1 text-[14px] font-medium">When should attendees see it?</legend>
        <label className="flex items-center gap-3 text-[14px]">
          <input
            type="radio"
            name="when"
            checked={when === "now"}
            onChange={() => setWhen("now")}
          />
          When I publish it, straight after the upload
        </label>
        <label className="flex flex-wrap items-center gap-3 text-[14px]">
          <input
            type="radio"
            name="when"
            checked={when === "later"}
            onChange={() => setWhen("later")}
          />
          Schedule it for
          <input
            className="input !min-h-[40px] !w-auto !py-1 !text-[14px]"
            type="datetime-local"
            value={publishAt}
            onChange={(e) => {
              setPublishAt(e.target.value);
              setWhen("later");
            }}
            aria-label="Go live at"
          />
        </label>
        <input type="hidden" name="publishAt" value={when === "later" ? publishAt : ""} />
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          Scheduling lets the photographers finish and you check the selection first. It goes live on the hour after
          this time, and attendees who asked are emailed.
        </p>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton className="soft-btn soft-btn-primary self-start" pendingText="Making the album…">
        {when === "later" ? "Schedule and start uploading" : "Create and start uploading"}
      </SubmitButton>
      <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
        The next screen is the drop zone. Uploads keep running while you move around, and each file picks up where it
        left off if the connection drops.
      </p>
    </form>
  );
}

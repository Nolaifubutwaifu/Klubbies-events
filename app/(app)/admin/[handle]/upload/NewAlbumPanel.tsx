"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { createAlbumAction, type ActionState } from "@/app/(app)/admin/actions";
import { EVENT_TYPES } from "@/lib/media/event-types";

/** Saturday morning: late enough that nobody is woken, early enough to matter. */
function nextSaturdayMorning(): { value: string; label: string } {
  const when = new Date();
  when.setHours(10, 0, 0, 0);
  const daysAhead = (6 - when.getDay() + 7) % 7 || 7;
  when.setDate(when.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    value: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T10:00`,
    label: `${when.toLocaleDateString("en-AU", { weekday: "long" })} 10:00am`,
  };
}

export function NewAlbumPanel({ clubId }: { clubId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createAlbumAction.bind(null, clubId), {});
  const saturday = nextSaturdayMorning();
  const [when, setWhen] = useState<"now" | "later">("later");
  const [publishAt, setPublishAt] = useState(saturday.value);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="soft-card flex flex-col gap-5 p-5 sm:p-6">
      <h2 className="soft-display text-[20px]">Album details</h2>

      <label className="field">
        Event name
        <input className="input" name="title" placeholder="Semester 2 Ball" required maxLength={160} autoFocus />
      </label>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label className="field">
          Date
          <input className="input" name="eventDate" type="date" defaultValue={today} />
        </label>
        <label className="field">
          Type
          <select className="input" name="eventType" defaultValue="">
            <option value="">No label</option>
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" name="allowDownload" defaultChecked />
          Members can download the originals
        </label>
        <label className="flex items-center gap-3 text-[14px]">
          <input
            type="checkbox"
            name="contributorScope"
            value="members"
          />
          Let members add their own photos to this album
        </label>
      </div>

      <fieldset className="m-0 flex flex-col gap-2.5 rounded-[var(--soft-r-sm)] bg-[color:var(--tone-support)] p-4 text-[color:var(--tone-support-ink)]">
        <legend className="px-1 text-[14px] font-bold">When should it go live?</legend>
        <label className="flex items-center gap-3 text-[14px]">
          <input
            type="radio"
            name="when"
            checked={when === "now"}
            onChange={() => setWhen("now")}
          />
          When I publish it, the second the upload finishes
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
        <p className="m-0 text-[14px]">Nobody wants a notification at 3am. Nobody wants to wait till Tuesday either.</p>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton className="soft-btn soft-btn-primary self-start" pendingText="Making the album…">
        {when === "later" ? "Schedule and start uploading" : "Create and start uploading"}
      </SubmitButton>
      <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
        The next screen is the drop zone. Uploads keep running while you move around Klubbies, and each file picks up
        where it left off if the connection drops.
      </p>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { HEARD_FROM } from "@/lib/attribution";
import { formatEventDates } from "@/lib/format";
import { generateHandleBase } from "@/lib/roster/handle";
import { createEventAction, type ActionState } from "../actions";

export function CreateEventForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createEventAction, {});
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [venue, setVenue] = useState("");
  const [mode, setMode] = useState<"link" | "guest_list">("link");
  const handle = generateHandleBase(name || "Your event");
  const host = appUrl.replace(/^https?:\/\//, "");
  const meta = [formatEventDates(startsOn, endsOn), venue].filter(Boolean).join(" · ");

  return (
    <form action={action} className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="flex flex-col gap-6">
        <div>
          <span className="kb-eyebrow">New event</span>
          <h1 className="serif mt-2 text-[44px] sm:text-[56px]">Create an event</h1>
          <p className="m-0 mt-2 max-w-[56ch] text-[16px] text-[color:var(--kb-ink-2)]">
            Attendees see these details on every screen. You can change all of it later, and nothing is charged until
            you activate.
          </p>
        </div>

        <label className="field">
          Event name
          <input
            className="input"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Brisbane Product Summit 2026"
            required
            maxLength={120}
            autoFocus
          />
        </label>
        <label className="field">
          Hosted by
          <input
            className="input"
            name="organisation"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="Company or organisation"
            maxLength={160}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            First day
            <input className="input" name="startsOn" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </label>
          <label className="field">
            Last day (optional)
            <input className="input" name="endsOn" type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
        </div>
        <label className="field">
          Venue or city
          <input className="input" name="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Brisbane Convention Centre" maxLength={160} />
        </label>
        <input type="hidden" name="description" value="" />

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="kb-label mb-2">Who can see the photos</legend>
          {(
            [
              ["link", "Anyone with the event link", "They confirm their email with a code, then they're in. Best for conferences and meetups."],
              ["guest_list", "Guest list only", "Only addresses you import can get in. Best for private and invite-only events."],
            ] as const
          ).map(([value, title, body]) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-[var(--kb-r-card)] border bg-[color:var(--kb-white)] p-3.5"
              style={{ borderColor: mode === value ? "var(--kb-ember)" : "var(--kb-line)" }}
            >
              <input type="radio" name="accessMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-0.5" />
              <span>
                <span className="block text-[15px] font-medium">{title}</span>
                <span className="block text-[14px] text-[color:var(--ink-70)]">{body}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          How did you hear about us? <span className="font-normal text-[color:var(--ink-70)]">(optional)</span>
          <select className="input" name="heardFrom" defaultValue="">
            <option value="">Choose one</option>
            {HEARD_FROM.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <FormMessage state={state} />
        <SubmitButton className="btn btn-primary btn-lg self-start" pendingText="Creating…">
          Create event
        </SubmitButton>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-8 lg:self-start">
        <span className="kb-label">What attendees will see</span>
        <div className="soft-card flex flex-col gap-3 p-6">
          {organisation ? <span className="kb-eyebrow">Hosted by {organisation}</span> : null}
          <span className="serif text-[34px]">{name || "Your event"}</span>
          {meta ? <span className="text-[14px] text-[color:var(--kb-ink-2)]">{meta}</span> : null}
          <span className="mt-2 rounded-[8px] bg-[color:var(--kb-cream)] p-3 text-[14px] text-[color:var(--kb-ink-2)]">
            Find the photos you&apos;re in
          </span>
        </div>
        <div className="break-all text-[14px] text-[color:var(--ink-70)]">
          {host}/e/<strong className="text-ink">{handle}</strong>
        </div>
        <p className="m-0 text-[14px] leading-normal text-[color:var(--ink-70)]">
          The link is made from the name and never changes, so printed QR codes keep working. If it&apos;s taken we add a
          number.
        </p>
      </aside>
    </form>
  );
}

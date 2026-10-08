"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { SetupSteps } from "@/components/SetupSteps";
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
  // Two steps on this screen, then the size once the event exists. Both steps
  // stay in the form, so everything is sent together at the end.
  const [step, setStep] = useState<1 | 2>(1);
  const detailsRef = useRef<HTMLDivElement>(null);

  function continueToAccess() {
    const fields = detailsRef.current?.querySelectorAll<HTMLInputElement>("input") ?? [];
    for (const field of fields) {
      if (!field.reportValidity()) return;
    }
    setStep(2);
    window.scrollTo({ top: 0 });
  }
  const handle = generateHandleBase(name || "Your event");
  const host = appUrl.replace(/^https?:\/\//, "");
  const meta = [formatEventDates(startsOn, endsOn), venue].filter(Boolean).join(" · ");

  return (
    <form
      action={action}
      onSubmit={(ev) => {
        // Enter on step 1 means Continue, not "create it now".
        if (step === 1) {
          ev.preventDefault();
          continueToAccess();
        }
      }}
      className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="flex flex-col gap-6">
        <SetupSteps
          steps={[
            { label: "Event details", state: step === 1 ? "current" : "done" },
            { label: "Who can get in", state: step === 2 ? "current" : "todo" },
            { label: "Event size", state: "todo" },
          ]}
        />
        <div>
          <span className="kb-eyebrow">New event · Step {step} of 3</span>
          <h1 className="serif mt-2 text-[40px] sm:text-[52px]">{step === 1 ? "Event details" : "Who can get in?"}</h1>
          <p className="m-0 mt-2 max-w-[56ch] text-[16px] text-[color:var(--kb-ink-2)]">
            {step === 1
              ? "Attendees see these on every screen. You can change them later."
              : "You can change this later too. Nothing is charged until you choose a paid size."}
          </p>
        </div>

        <div ref={detailsRef} className={`flex flex-col gap-6 ${step === 1 ? "" : "hidden"}`}>

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
              placeholder="Your name, club or company"
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
          <button type="button" className="btn btn-primary btn-lg self-start" onClick={continueToAccess}>
            Continue
          </button>
        </div>

        <div className={`flex flex-col gap-6 ${step === 2 ? "" : "hidden"}`}>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Who can see the photos</legend>
            {(
              [
                ["link", "Anyone with the event link", "They confirm their email with a code, then they're in. Best for conferences and meetups."],
                ["guest_list", "Guest list only", "Only addresses you import can get in. Best for private and invite-only events."],
              ] as const
            ).map(([value, title, body]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-[var(--kb-r-card)] border bg-[color:var(--kb-white)] p-3.5"
                style={{
                  borderColor: mode === value ? "var(--kb-brand)" : "var(--kb-line)",
                  boxShadow: mode === value ? "0 0 0 1px var(--kb-brand)" : undefined,
                }}
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
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="btn btn-primary btn-lg" pendingText="Creating…">
              Continue to event size
            </SubmitButton>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </div>
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

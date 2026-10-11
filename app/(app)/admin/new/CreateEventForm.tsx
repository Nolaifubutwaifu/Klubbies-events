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
      className="flex flex-1 flex-col">
      <div className="border-b border-[color:var(--kb-line)] bg-white">
        <div className="mx-auto w-full max-w-[1100px] px-5 py-4 sm:px-8">
          <SetupSteps
            steps={[
              { label: "Event details", state: step === 1 ? "current" : "done" },
              { label: "Who can get in", state: step === 2 ? "current" : "todo" },
              { label: "Event size", state: "todo" },
            ]}
          />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <div className="flex max-w-[560px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="mono text-[14px] font-medium text-[color:var(--kb-brand-deep)]">Step {step} of 3</span>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[32px]">{step === 1 ? "Tell us about the event" : "Who can get in?"}</h1>
          <p className="m-0 max-w-[56ch] text-[16px] text-[color:var(--kb-ink-2)]">
            {step === 1
              ? "You can change all of this later in Settings."
              : "You can switch any time, even after people have joined. Nothing is charged until you choose a paid size."}
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
            <span className="flex justify-between">
              Hosted by <span className="font-normal text-[color:var(--kb-ink-3)]">Shown to attendees</span>
            </span>
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
              <span className="flex justify-between">
                Last day <span className="font-normal text-[color:var(--kb-ink-3)]">Optional</span>
              </span>
              <input className="input" name="endsOn" type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span className="flex justify-between">
              Venue or city <span className="font-normal text-[color:var(--kb-ink-3)]">Optional</span>
            </span>
            <input className="input" name="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Brisbane Convention Centre" maxLength={160} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Event link</span>
            <span className="mono break-all rounded-[8px] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] px-3.5 py-3 text-[15px]">
              <span className="text-[color:var(--kb-ink-3)]">{host}/e/</span>
              {handle}
            </span>
            <span className="kb-help">Made from the name. It never changes once attendees have it; if it&apos;s taken we add a number.</span>
          </div>
          <input type="hidden" name="description" value="" />
          <button type="button" className="btn btn-primary btn-lg self-start" onClick={continueToAccess}>
            Continue
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className={`flex flex-col gap-6 ${step === 2 ? "" : "hidden"}`}>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Who can see the photos</legend>
            {(
              [
                ["link", "Anyone with the event link", "Anyone who scans the QR code or opens the link, then confirms their email, joins. Best for open conferences and meetups."],
                ["guest_list", "Guest list only", "Only the emails on your list get a code, even if the link is shared. Import from Eventbrite, Humanitix, Luma or a spreadsheet next."],
              ] as const
            ).map(([value, title, body]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-4 rounded-[12px] border bg-[color:var(--kb-white)] p-5"
                style={{
                  borderColor: mode === value ? "var(--kb-brand)" : "var(--kb-line)",
                  boxShadow: mode === value ? "0 0 0 1px var(--kb-brand)" : undefined,
                }}
              >
                <span className="kb-icon-well" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    {value === "link" ? (
                      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                    ) : (
                      <>
                        <path d="M9 6h11M9 12h11M9 18h11" />
                        <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
                      </>
                    )}
                  </svg>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
                    {title}
                    {value === "link" ? <span className="kb-chip bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]">Recommended</span> : null}
                  </span>
                  <span className="text-[14px] text-[color:var(--kb-ink-2)]">{body}</span>
                </span>
                <input type="radio" name="accessMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
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
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(1)}>
              Back
            </button>
            <SubmitButton className="btn btn-primary btn-lg" pendingText="Creating…">
              Continue
            </SubmitButton>
          </div>
        </div>
      </div>

      <aside aria-label="Preview" className="flex flex-col gap-3 lg:sticky lg:top-8 lg:self-start">
        <span className="text-[14px] font-medium text-[color:var(--kb-ink-2)]">What attendees will see</span>
        <div aria-hidden className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border-[6px] border-[#05070d] bg-[color:var(--kb-cream)]">
          <div className="relative h-[92px] bg-[color:var(--kb-brand)]">
            <span className="absolute -bottom-6 left-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[color:var(--kb-ink)] text-[14px] font-bold text-white shadow-[0_0_0_3px_var(--kb-cream)]">
              {(name || "Your event")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 3)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-5 pt-9">
            <span className="serif text-[26px] leading-[1.05]">{name || "Your event"}</span>
            <span className="text-[13px] text-[color:var(--kb-ink-2)]">{meta || "Date · Venue"}</span>
            {organisation ? <span className="text-[13px] text-[color:var(--kb-ink-2)]">Hosted by {organisation}</span> : null}
            <span className="mt-2 h-9 rounded-[6px] border border-[color:var(--kb-line-input)] bg-white" />
            <span className="h-9 rounded-[6px] border border-[color:var(--kb-line-input)] bg-white" />
            <span className="flex h-10 items-center justify-center rounded-[6px] bg-[color:var(--kb-ink)] text-[14px] font-semibold text-white">Get my photos</span>
          </div>
        </div>
        <p className="m-0 text-center text-[14px] text-[color:var(--kb-ink-3)]">Add your logo and colour after these three steps.</p>
      </aside>
      </div>
    </form>
  );
}

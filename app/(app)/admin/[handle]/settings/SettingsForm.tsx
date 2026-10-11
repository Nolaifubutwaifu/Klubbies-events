"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { formatEventDates } from "@/lib/format";
import { ACCENT_SWATCHES, eventToneStyle, SWATCH_NAMES } from "@/lib/theme";
import { updateEventAction, type ActionState } from "../../actions";

export function SettingsForm({
  eventId,
  name,
  organisation,
  description,
  startsOn,
  endsOn,
  venue,
  accentColour,
}: {
  eventId: string;
  name: string;
  organisation: string | null;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  accentColour: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateEventAction.bind(null, eventId), {});
  const [accent, setAccent] = useState(accentColour ?? "");
  const preview = eventToneStyle(accent);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-8">
      <div className="flex min-w-0 flex-[3_1_380px] flex-col gap-4">
      <label className="field">
        Event name
        <input className="input" name="name" defaultValue={name} required maxLength={120} />
      </label>
      <label className="field">
        Hosted by
        <input className="input" name="organisation" defaultValue={organisation ?? ""} maxLength={160} placeholder="Your name, club or company" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          First day
          <input className="input" name="startsOn" type="date" defaultValue={startsOn ?? ""} />
        </label>
        <label className="field">
          Last day (optional)
          <input className="input" name="endsOn" type="date" defaultValue={endsOn ?? ""} />
        </label>
      </div>
      <label className="field">
        Venue or city
        <input className="input" name="venue" defaultValue={venue ?? ""} maxLength={160} placeholder="ICC Sydney" />
      </label>
      <label className="field">
        Description
        <textarea
          className="input"
          name="description"
          defaultValue={description ?? ""}
          maxLength={1000}
          placeholder="One or two lines attendees see under the event name."
        />
      </label>

      <div className="flex flex-col gap-3">
        <span className="text-[14px] font-medium">Event colour</span>
        <span className="text-[14px] leading-normal text-[color:var(--kb-ink-3)]">
          Used for bands, highlights and the selected tab on attendee screens. Darkened automatically if text on it would
          be hard to read.
        </span>
        <input type="hidden" name="accentColour" value={accent} />
        {/* A named radio group: arrow keys move between colours and the
            choice is announced, rather than ten buttons read as hex codes. */}
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Brand colour">
          {ACCENT_SWATCHES.map((swatch, i) => {
            const chosen = accent.toLowerCase() === swatch;
            const focusable = chosen || (!ACCENT_SWATCHES.includes(accent.toLowerCase()) && i === 0);
            return (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={SWATCH_NAMES[swatch] ?? swatch}
              tabIndex={focusable ? 0 : -1}
              onClick={() => setAccent(swatch)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const next = ACCENT_SWATCHES[(i + step + ACCENT_SWATCHES.length) % ACCENT_SWATCHES.length];
                setAccent(next);
                (e.currentTarget.parentElement?.children[(i + step + ACCENT_SWATCHES.length) % ACCENT_SWATCHES.length] as HTMLElement | undefined)?.focus();
              }}
              className={`relative h-8 w-8 cursor-pointer rounded-full border-0 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 ${
                chosen ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--kb-ink)]" : ""
              }`}
              style={{ background: swatch }}
            >
              {chosen ? (
                <svg viewBox="0 0 24 24" aria-hidden className="absolute inset-0 m-auto h-4 w-4" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </button>
            );
          })}
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="color"
              value={accent || "#2b4acb"}
              onChange={(e) => setAccent(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-[6px] border border-[color:var(--kb-line)] bg-transparent p-0 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
              aria-label="Pick a custom colour"
            />
            <input
              className="input mono w-[112px] text-[14px]"
              value={accent}
              onChange={(e) => setAccent(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
              pattern="#[0-9a-fA-F]{6}"
              aria-label="Hex colour"
              placeholder="#2b4acb"
            />
          </label>
          {accent ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAccent("")}>
              Default
            </button>
          ) : null}
        </div>
      </div>
      </div>

      {/* What attendees see, live as the colour changes. */}
      <div className="flex min-w-0 flex-[2_1_260px] flex-col gap-2 lg:sticky lg:top-24">
        <span className="text-[14px] font-medium text-[color:var(--kb-ink-2)]">Preview</span>
        <div className="overflow-hidden rounded-[12px] border border-[color:var(--kb-line)] bg-white" style={preview} aria-hidden>
          <div className="flex flex-col gap-1.5 bg-[color:var(--tone-support,var(--kb-sand))] p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[color:var(--kb-ember)] text-[12px] font-bold text-white">
              {name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 3)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="serif text-[24px] leading-[1.05]">{name}</span>
            <span className="text-[14px] text-[color:var(--kb-ink-2)]">{[formatEventDates(startsOn, endsOn), venue].filter(Boolean).join(" · ") || "Date and venue"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="text-[15px] font-semibold">23 photos of you</span>
            {/* Attendee screens keep ink buttons; the organiser side's blue isn't theirs. */}
            <span className="rounded-[8px] bg-[color:var(--kb-ink)] px-3 py-2 text-[14px] font-semibold text-white">Download all</span>
          </div>
          <div className="flex border-t border-[color:var(--kb-line)] text-center text-[14px]">
            <span className="flex-1 py-2.5 font-semibold text-[color:var(--kb-ember)]">Photos</span>
            <span className="flex-1 py-2.5 text-[color:var(--kb-ink-3)]">Your photos</span>
            <span className="flex-1 py-2.5 text-[color:var(--kb-ink-3)]">Saved</span>
          </div>
        </div>
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">Buttons stay ink so your colour never makes them hard to read.</p>
      </div>
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary self-start" pendingText="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

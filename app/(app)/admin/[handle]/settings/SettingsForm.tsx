"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
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
    <form action={action} className="soft-card flex flex-col gap-4 p-5">
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
        <span className="text-[14px] font-medium">Brand colour</span>
        <span className="text-[14px] leading-normal text-[color:var(--ink-70)]">
          Used for links, highlights and the selected tab on every attendee screen. Buttons stay dark so they read on
          any colour, and light colours are darkened until text on white is readable.
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
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] p-3" style={preview} aria-hidden>
          <span className="soft-chip">Your photos</span>
          <span className="text-[14px] font-medium text-[color:var(--kb-ember)] underline underline-offset-4">See all 23</span>
          <input type="checkbox" checked readOnly tabIndex={-1} />
          {/* Attendee screens keep ink buttons; the organiser side's blue isn't theirs. */}
          <span className="btn btn-primary btn-sm" style={{ background: "var(--kb-ink)", borderColor: "var(--kb-ink)" }}>
            Download all
          </span>
        </div>
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary self-start" pendingText="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

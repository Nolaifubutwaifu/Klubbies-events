"use client";

import { useState, useTransition, type ReactNode } from "react";
import { setEventAccessAction } from "@/app/(app)/admin/actions";

/** Import a list and Add attendee: two buttons that open their panel under the heading. */
export function AttendeeButtons({ importPanel, addPanel }: { importPanel: ReactNode; addPanel: ReactNode }) {
  const [open, setOpen] = useState<"import" | "add" | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" aria-expanded={open === "import"} onClick={() => setOpen(open === "import" ? null : "import")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
          </svg>
          Import a list
        </button>
        <button type="button" className="btn btn-primary" aria-expanded={open === "add"} onClick={() => setOpen(open === "add" ? null : "add")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add attendee
        </button>
      </div>
      {open ? <div className="w-full">{open === "import" ? importPanel : addPanel}</div> : null}
    </>
  );
}

/** Who can get in, as two cards that save on choice. The closing date stays as it is. */
export function AccessModeCards({ eventId, mode, endsOn }: { eventId: string; mode: "link" | "guest_list"; endsOn: string }) {
  const [current, setCurrent] = useState(mode);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const choose = (next: "link" | "guest_list") => {
    if (next === current) return;
    setCurrent(next);
    startTransition(async () => {
      const form = new FormData();
      form.set("accessMode", next);
      form.set("accessEndsOn", endsOn);
      const res = await setEventAccessAction(eventId, {}, form);
      setMessage(res.error ?? res.message ?? "");
      if (res.error) setCurrent(current);
    });
  };
  const options = [
    { value: "link" as const, title: "Anyone with the event link", body: "Anyone who opens it and confirms their email joins." },
    { value: "guest_list" as const, title: "Guest list only", body: "Only people on your list get a code, even with the link." },
  ];
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[15px] font-semibold">Who can get in</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[10px] border bg-white p-4 ${
              current === option.value ? "border-[1.5px] border-[color:var(--kb-brand)]" : "border-[color:var(--kb-line)] hover:border-[color:var(--kb-line-strong)]"
            }`}
          >
            <input type="radio" name="accessMode" checked={current === option.value} disabled={pending} onChange={() => choose(option.value)} className="mt-0.5" />
            <span className="flex flex-col">
              <span className="font-semibold">{option.title}</span>
              <span className="text-[14px] text-[color:var(--kb-ink-2)]">{option.body}</span>
            </span>
          </label>
        ))}
      </div>
      {message ? (
        <span className="text-[14px] text-[color:var(--kb-ink-3)]" role="status">
          {message}
        </span>
      ) : null}
    </fieldset>
  );
}

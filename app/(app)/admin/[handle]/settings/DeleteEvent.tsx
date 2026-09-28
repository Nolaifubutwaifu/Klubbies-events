"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms";
import { deleteEventAction, type ActionState } from "../../actions";

/** The danger zone: closed until asked for, then one typed confirmation. */
export function DeleteEvent({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteEventAction.bind(null, eventId), {});
  const matches = typed.trim().toLowerCase() === eventName.trim().toLowerCase();

  return (
    <div className="soft-card flex flex-col gap-3 p-5">
      <span className="text-[15px] font-medium">Delete this event</span>
      <p className="m-0 max-w-[62ch] text-[14px] text-[color:var(--ink-70)]">
        Takes the event offline for attendees and photographers straight away. Any organiser can restore it from Your
        events for 30 days; after that every photo, video, attendee and all face search data are deleted for good. A
        payment for the event isn&apos;t refunded by deleting it.
      </p>
      {open ? (
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="kb-label">Type the event name to confirm</span>
            <input
              name="confirm"
              className="input"
              autoComplete="off"
              placeholder={eventName}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          <FormMessage state={state} />
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-danger" disabled={!matches || pending}>
              {pending ? "Deleting…" : "Delete event"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
              Keep it
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-danger btn-sm self-start" onClick={() => setOpen(true)}>
          Delete this event
        </button>
      )}
    </div>
  );
}

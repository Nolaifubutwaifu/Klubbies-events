"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { addMemberAction, type ActionState } from "../../actions";

export function AddMemberForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addMemberAction.bind(null, eventId), {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="soft-card flex flex-col gap-3 p-4">
      <span className="text-[14px] font-semibold">Add one person</span>
      {/* Visible labels: a placeholder disappears the moment you type. */}
      <label className="field">
        Full name
        <input className="input" name="name" required maxLength={200} autoComplete="off" />
      </label>
      <label className="field">
        Email
        <input className="input" name="email" type="email" required autoComplete="off" />
      </label>
      <label className="field">
        Role
      <select className="input" name="roleKey" defaultValue="member">
        <option value="member">Attendee</option>
        <option value="photographer">Photographer (uploads with an account)</option>
        <option value="admin">Organiser (full access)</option>
      </select>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary self-start" pendingText="Adding…">
        Add
      </SubmitButton>
    </form>
  );
}

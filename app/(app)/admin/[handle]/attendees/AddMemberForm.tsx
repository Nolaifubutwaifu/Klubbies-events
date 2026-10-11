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
    <form ref={form} action={action} className="grid gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 sm:grid-cols-[1fr_1fr_220px_auto] sm:items-end">
      <span className="text-[16px] font-semibold sm:col-span-4">Add one person</span>
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
      <SubmitButton className="btn btn-primary" pendingText="Adding…">
        Add
      </SubmitButton>
      <div className="sm:col-span-4 empty:hidden">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

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
      <input className="input text-[14px]" name="name" placeholder="Full name" required maxLength={200} aria-label="Full name" />
      <input className="input text-[14px]" name="email" type="email" placeholder="Email" required aria-label="Email" />
      <select className="input text-[14px]" name="roleKey" defaultValue="member" aria-label="Role">
        <option value="member">Attendee</option>
        <option value="photographer">Photographer (uploads with an account)</option>
        <option value="admin">Organiser (full access)</option>
      </select>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary justify-start text-[14px]" pendingText="Adding…">
        Add
      </SubmitButton>
    </form>
  );
}

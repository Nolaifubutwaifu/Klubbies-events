"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { addMemberAction, type ActionState } from "../../actions";

export function AddMemberForm({ clubId }: { clubId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addMemberAction.bind(null, clubId), {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3 soft-card p-4">
      <span className="text-[14px] font-semibold">Or add one by hand</span>
      <input className="input text-[14px]" name="name" placeholder="Full name" required maxLength={200} aria-label="Full name" />
      <input className="input text-[14px]" name="email" type="email" placeholder="Email" required aria-label="Email" />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary justify-start text-[14px]" pendingText="Adding…">
        Add member
      </SubmitButton>
    </form>
  );
}

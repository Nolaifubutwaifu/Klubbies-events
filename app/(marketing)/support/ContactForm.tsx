"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { sendContactAction, type ContactState } from "./actions";
import { CONTACT_TOPICS } from "./topics";

export function ContactForm() {
  const [state, action] = useActionState<ContactState, FormData>(sendContactAction, {});
  const started = useRef<HTMLInputElement>(null);
  const values = state.values;

  // When the form appeared, so the server can turn away instant (bot) submits.
  useEffect(() => {
    if (started.current) started.current.value = String(Date.now());
  }, [state]);

  return (
    <form action={action} id="contact" className="flex scroll-mt-28 flex-col gap-5">
      <input ref={started} type="hidden" name="started" defaultValue="" />
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        Your name
        <input className="input !min-h-[48px]" name="name" required maxLength={200} autoComplete="name" defaultValue={values?.name} />
      </label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        Email
        <input className="input !min-h-[48px]" name="email" type="email" required maxLength={320} autoComplete="email" defaultValue={values?.email} />
      </label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        <span className="flex justify-between">
          Event <span className="font-normal text-[color:var(--kb-ink-3)]">Optional</span>
        </span>
        <input className="input !min-h-[48px]" name="event" maxLength={200} placeholder="Name or link of the event" defaultValue={values?.event} />
      </label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        Topic
        <select className="input !min-h-[48px]" name="topic" defaultValue={values?.topic || "help"}>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold">
        Message
        <textarea className="input min-h-[140px]" name="message" required minLength={10} maxLength={5000} defaultValue={values?.message} />
      </label>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}

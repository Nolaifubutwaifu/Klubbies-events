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
    <form action={action} id="contact" className="flex scroll-mt-6 flex-col gap-3">
      <input ref={started} type="hidden" name="started" defaultValue="" />
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[15px] font-semibold">
        Your email
        <input className="input" name="email" type="email" required maxLength={320} autoComplete="email" defaultValue={values?.email} />
      </label>
      <label className="flex flex-col gap-1 text-[15px] font-semibold">
        <span>
          Your name <span className="font-normal text-[color:var(--kb-ink-3)]">(optional)</span>
        </span>
        <input className="input" name="name" maxLength={200} autoComplete="name" defaultValue={values?.name} />
      </label>
      <label className="flex flex-col gap-1 text-[15px] font-semibold">
        <span>
          Event name <span className="font-normal text-[color:var(--kb-ink-3)]">(if it&apos;s about one)</span>
        </span>
        <input className="input" name="event" maxLength={200} defaultValue={values?.event} />
      </label>
      <label className="flex flex-col gap-1 text-[15px] font-semibold">
        What it&apos;s about
        <select className="input" name="topic" defaultValue={values?.topic || "help"}>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[15px] font-semibold">
        Message
        <textarea className="input min-h-[140px]" name="message" required minLength={10} maxLength={5000} defaultValue={values?.message} />
      </label>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary self-start" pendingText="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}

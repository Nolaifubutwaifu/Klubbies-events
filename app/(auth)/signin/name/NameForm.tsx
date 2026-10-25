"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

/** Asked once, after the email code, and only when the account has no name yet. */
export function NameForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorTick, setErrorTick] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  // Disabling the submit button while the request is in flight drops focus to
  // the page. Put it back on the field once the error is in the DOM, including
  // when a second attempt fails with the same message.
  useEffect(() => {
    if (errorTick) nameRef.current?.focus();
  }, [errorTick]);

  function showError(message: string) {
    setError(message);
    setPending(false);
    setErrorTick((tick) => tick + 1);
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/claim_name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      const body: { error?: string; redirectTo?: string } = await res.json().catch(() => ({}));
      // 409 means the account already has a name: follow the return path
      // instead of showing that as an error on this screen.
      if (body.redirectTo && (res.ok || res.status === 409)) {
        router.replace(body.redirectTo);
        router.refresh();
        return;
      }
      showError(body.error ?? "Something went wrong. Try again.");
    } catch {
      showError("You seem to be offline. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="kb-label !text-[15px] !font-semibold">
          Your name
        </label>
        <input
          ref={nameRef}
          id="name"
          className="input !min-h-[52px]"
          name="name"
          autoComplete="name"
          required
          maxLength={200}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "name-help name-error" : "name-help"}
        />
        <span id="name-help" className="kb-help">
          Organisers and photographers see this.
        </span>
      </div>
      {error ? (
        <p id="name-error" className="kb-error m-0" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

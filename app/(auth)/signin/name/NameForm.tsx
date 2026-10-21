"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** Asked once, after the email code, and only when the account has no name yet. */
export function NameForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
      if (!res.ok || !body.redirectTo) {
        setError(body.error ?? "Something went wrong. Try again.");
        setPending(false);
        return;
      }
      router.replace(body.redirectTo);
      router.refresh();
    } catch {
      setError("You seem to be offline. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="kb-label !text-[15px] !font-semibold">
          Your name
        </label>
        <input
          id="name"
          className="input !min-h-[52px]"
          name="name"
          autoComplete="name"
          required
          maxLength={200}
          aria-describedby="name-help"
        />
        <span id="name-help" className="kb-help">
          Organisers and photographers see this.
        </span>
      </div>
      {error ? (
        <p className="kb-error m-0" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "code" | "password";

/**
 * One form, two ways in: a code by email (the default) or a password for
 * members who set one. Deliberately one secondary link and nothing else.
 */
export function SignInForm({ flow, club }: { flow: "member" | "create"; club?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function requestCode(form: FormData) {
    const res = await fetch("/api/auth/request_code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), flow }),
    });
    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }
    const params = new URLSearchParams();
    if (flow === "create") params.set("flow", "create");
    if (club) params.set("club", club);
    const query = params.toString();
    router.push(query ? `/signin/code?${query}` : "/signin/code");
  }

  async function signInWithPassword(form: FormData) {
    const res = await fetch("/api/auth/password_signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), club }),
    });
    const body: { error?: string; redirectTo?: string } = await res.json().catch(() => ({}));
    if (!res.ok || !body.redirectTo) {
      setError(body.error ?? "That didn't work. Try a code instead.");
      setPending(false);
      return;
    }
    router.replace(body.redirectTo);
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      if (mode === "password") await signInWithPassword(form);
      else await requestCode(form);
    } catch {
      setError("You seem to be offline. Try again.");
      setPending(false);
    }
  }

  const submitLabel = pending
    ? mode === "password"
      ? "Logging in…"
      : "Sending…"
    : mode === "password"
      ? "Log in"
      : flow === "create"
        ? "Email me a code to continue"
        : "Email me a code";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate={false}>
      {mode === "code" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="fullName" className="kb-label">
            Full name
          </label>
          <input id="fullName" className="input" name="fullName" autoComplete="name" required maxLength={200} aria-describedby="fullName-help" />
          <span id="fullName-help" className="kb-help">
            {flow === "create" ? "Shown to your members as the club's admin." : "As it appears on your club's list."}
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="kb-label">
          Email
        </label>
        <input id="email" className="input" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} />
      </div>
      {mode === "password" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="kb-label">
            Password
          </label>
          <input id="password" className="input" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </div>
      ) : null}
      {error ? (
        <p className="kb-error m-0" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {submitLabel}
      </button>

      {flow === "member" ? (
        <button
          type="button"
          className="kb-link self-center"
          onClick={() => {
            setMode(mode === "code" ? "password" : "code");
            setError("");
          }}
        >
          {mode === "code" ? "Use a password instead" : "Email me a code instead"}
        </button>
      ) : null}
    </form>
  );
}

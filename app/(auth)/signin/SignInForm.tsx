"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { safeNextPath } from "@/lib/auth/next-path";

type Mode = "code" | "password";

/**
 * One form, two ways in: a code by email (the default) or a password for
 * members who set one. Deliberately one secondary link and nothing else.
 */
export function SignInForm({ flow, event }: { flow: "member" | "create" | "join"; event?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function requestCode(form: FormData) {
    const fullName = form.get("fullName");
    const res = await fetch("/api/auth/request_code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // Sign-in and event links ask for a name only after the code, and only
        // for a new account. Creating an event still collects it here.
        ...(typeof fullName === "string" && fullName.trim() ? { fullName } : {}),
        email: form.get("email"),
        flow,
        event,
      }),
    });
    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }
    const params = new URLSearchParams();
    if (flow === "create") params.set("flow", "create");
    if (event) params.set("event", event);
    const query = params.toString();
    router.push(query ? `/signin/code?${query}` : "/signin/code");
  }

  async function signInWithPassword(form: FormData) {
    const res = await fetch("/api/auth/password_signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), event }),
    });
    const body: { error?: string; redirectTo?: string } = await res.json().catch(() => ({}));
    if (!res.ok || !body.redirectTo) {
      setError(body.error ?? "That didn't work. Try a code instead.");
      setPending(false);
      return;
    }
    router.replace(safeNextPath(body.redirectTo) ?? "/events");
    router.refresh();
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
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
        : flow === "join"
          ? "Get my photos"
          : "Email me a code";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate={false}>
      {mode === "code" && flow === "create" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="fullName" className="kb-label !text-[15px] !font-semibold">
            Your name
          </label>
          <input id="fullName" className="input !min-h-[52px]" name="fullName" autoComplete="name" required maxLength={200} aria-describedby="fullName-help" />
          <span id="fullName-help" className="kb-help">
            Shown to attendees and photographers as the organiser.
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="kb-label !text-[15px] !font-semibold">
          Email
        </label>
        <input
          id="email"
          className="input !min-h-[52px]"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          aria-describedby={flow === "create" ? "email-help" : undefined}
        />
        {flow === "create" ? (
          <span id="email-help" className="kb-help">
            We&apos;ll send a code here to confirm it&apos;s you.
          </span>
        ) : null}
      </div>
      {mode === "password" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="kb-label !text-[15px] !font-semibold">
            Password
          </label>
          <input id="password" className="input !min-h-[52px]" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </div>
      ) : null}
      {error ? (
        <p className="kb-error m-0" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {submitLabel}
        {pending || flow === "join" ? null : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>

      {/* Someone joining from an event's link has no password yet. */}
      {flow === "member" ? (
        <div className="flex items-center gap-4 text-[14px] text-[color:var(--kb-ink-3)]" aria-hidden>
          <span className="h-px flex-1 bg-[color:var(--kb-line)]" />
          or
          <span className="h-px flex-1 bg-[color:var(--kb-line)]" />
        </div>
      ) : null}
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

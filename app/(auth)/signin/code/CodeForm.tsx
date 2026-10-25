"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { safeNextPath } from "@/lib/auth/next-path";

/** Supabase mints eight digits for this project, so there are eight boxes. */
const LENGTH = 8;
const RESEND_COOLDOWN_S = 30;
/** Codes work for ten minutes from when they were sent. */
const CODE_LIFETIME_S = 600;

export function CodeForm({ event, help }: { event?: string; help: React.ReactNode }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [refocus, setRefocus] = useState(0);
  const [left, setLeft] = useState(CODE_LIFETIME_S);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  // After a wrong code, focus goes back to the first box once the boxes are
  // editable again, so the phone keyboard stays open.
  useEffect(() => {
    if (refocus && !pending) boxes.current[0]?.focus();
  }, [refocus, pending]);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setError("");
    setResent("");
    setCooldown(RESEND_COOLDOWN_S);
    try {
      const res = await fetch("/api/auth/resend_code", { method: "POST" });
      const body: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "That didn't work. Try again.");
        setCooldown(0);
        return;
      }
      setResent("Sent again. Use the newest email.");
      setLeft(CODE_LIFETIME_S);
      setDigits(Array(LENGTH).fill(""));
      setRefocus((n) => n + 1);
    } catch {
      setError("You seem to be offline. Try again.");
      setCooldown(0);
    }
  }

  async function submit(value: string) {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify_code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value, event }),
      });
      const body: { error?: string; redirectTo?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !body.redirectTo) {
        setError(body.error ?? "That code didn't work.");
        setPending(false);
        // Clear and go back to the first box: retyping beats hunting for the
        // wrong digit.
        setDigits(Array(LENGTH).fill(""));
        setRefocus((n) => n + 1);
        return;
      }
      router.replace(safeNextPath(body.redirectTo) ?? "/events");
      router.refresh();
    } catch {
      setError("You seem to be offline. Try again.");
      setPending(false);
    }
  }

  /** Accepts one digit, or a whole pasted code landing in any box. */
  function write(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    const next = [...digits];
    for (let i = 0; i < typed.length && index + i < LENGTH; i++) next[index + i] = typed[i];
    setDigits(next);
    setError("");

    const filledTo = Math.min(index + typed.length, LENGTH - 1);
    boxes.current[filledTo]?.focus();
    // join() drops nothing for empty slots, so a full code is exactly LENGTH
    // characters long and a gap anywhere makes it shorter.
    const joined = next.join("");
    if (joined.length === LENGTH) void submit(joined);
  }

  function onKeyDown(index: number, ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "Backspace") {
      ev.preventDefault();
      const next = [...digits];
      if (next[index]) next[index] = "";
      else if (index > 0) {
        next[index - 1] = "";
        boxes.current[index - 1]?.focus();
      }
      setDigits(next);
      return;
    }
    if (ev.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (ev.key === "ArrowRight" && index < LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        if (code.length === LENGTH) void submit(code);
      }}
      className="flex flex-col gap-5"
    >
      {/* One box per digit, in a row that stays inside a narrow phone. */}
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 text-[15px] font-semibold">Sign-in code</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                boxes.current[index] = el;
              }}
              id={`code-${index}`}
              value={digit}
              onChange={(ev) => write(index, ev.target.value)}
              onKeyDown={(ev) => onKeyDown(index, ev)}
              onFocus={(ev) => ev.target.select()}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${index + 1} of ${LENGTH}`}
              autoFocus={index === 0}
              readOnly={pending}
              aria-busy={pending}
              className="mono h-14 w-full min-w-0 rounded-[8px] bg-white text-center text-[22px] font-medium text-[color:var(--kb-ink)] caret-[color:var(--kb-ember)] outline-none focus-visible:!border-2 focus-visible:!border-[color:var(--kb-ink)]"
              style={{ border: `1px solid ${digit ? "var(--kb-ink)" : "var(--kb-line-input)"}` }}
            />
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="kb-error m-0 text-center" role="alert">
          {error}
        </p>
      ) : null}
      <p className="kb-help m-0 text-center empty:hidden" role="status">
        {resent}
      </p>

      {/* The boxes submit themselves once they're full; this is for anyone who
          gets there another way. */}
      <button type="submit" className="btn btn-primary w-full" disabled={pending || code.length < LENGTH}>
        {pending ? "Checking…" : "Continue"}
      </button>

      <details className="group border-y border-[color:var(--kb-line)]">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
          Nothing arrived?
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden className="transition-transform group-open:rotate-180">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="pb-4 text-[15px] text-[color:var(--kb-ink-2)]">{help}</div>
      </details>

      <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
        Codes can take a minute and sometimes land in spam. Still nothing?{" "}
        <button type="button" className="kb-link !inline !min-h-[44px] align-baseline" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
        </button>
      </p>

      <p className="mono m-0 text-center text-[14px] text-[color:var(--kb-ink-3)]" aria-live="off">
        {left > 0 ? `Code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "This code has expired. Send a new one."}
      </p>
    </form>
  );
}

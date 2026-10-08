"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Supabase mints eight digits for this project, so there are eight boxes. */
const LENGTH = 8;
const RESEND_COOLDOWN_S = 30;

export function CodeForm({ event }: { event?: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [refocus, setRefocus] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  // After a wrong code, focus goes back to the first box once the boxes are
  // editable again, so the phone keyboard stays open.
  useEffect(() => {
    if (refocus && !pending) boxes.current[0]?.focus();
  }, [refocus, pending]);

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
      router.replace(body.redirectTo);
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
      <div className="flex justify-center gap-1.5 sm:gap-2" role="group" aria-label="Sign-in code">
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
            className="mono h-[54px] w-full min-w-0 max-w-[46px] rounded-[8px] bg-white text-center text-[22px] font-medium text-[color:var(--kb-ink)] caret-[color:var(--kb-ember)] outline-none focus-visible:!border-[color:var(--kb-ember)] focus-visible:shadow-[0_0_0_3px_var(--kb-ember-tint)]"
            style={{ border: `1.5px solid ${digit ? "var(--kb-ink)" : "var(--kb-line-input)"}` }}
          />
        ))}
      </div>

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

      <button type="button" className="kb-link self-center" onClick={resend} disabled={cooldown > 0}>
        {cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
      </button>
    </form>
  );
}

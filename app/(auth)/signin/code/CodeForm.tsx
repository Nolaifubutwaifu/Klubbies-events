"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Supabase mints eight digits for this project, so there are eight boxes. */
const LENGTH = 8;

export function CodeForm({ restartHref, club }: { restartHref: string; club?: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  async function submit(value: string) {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify_code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value, club }),
      });
      const body: { error?: string; redirectTo?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !body.redirectTo) {
        setError(body.error ?? "That code didn't work.");
        setPending(false);
        // Clear and go back to the first box: retyping beats hunting for the
        // wrong digit.
        setDigits(Array(LENGTH).fill(""));
        boxes.current[0]?.focus();
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

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) next[index] = "";
      else if (index > 0) {
        next[index - 1] = "";
        boxes.current[index - 1]?.focus();
      }
      setDigits(next);
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
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
            onChange={(event) => write(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            autoFocus={index === 0}
            disabled={pending}
            className="soft-display h-[58px] w-full min-w-0 max-w-[48px] rounded-[14px] bg-white text-center text-[24px] text-[color:var(--kb-ink)] caret-[color:var(--kb-ember)] outline-none focus-visible:border-2 focus-visible:!border-[color:var(--kb-ink)] focus-visible:shadow-[0_0_0_4px_var(--kb-ember-tint)]"
            style={{ border: `1.5px solid ${digit ? "var(--kb-ink)" : "var(--kb-line-input)"}` }}
          />
        ))}
      </div>

      {error ? (
        <p className="kb-error m-0 text-center" role="alert">
          {error}
        </p>
      ) : null}

      {/* The boxes submit themselves once they're full; this is for anyone who
          gets there another way. */}
      <button type="submit" className="btn btn-primary w-full" disabled={pending || code.length < LENGTH}>
        {pending ? "Checking…" : "Log in"}
      </button>

      <Link href={restartHref} className="kb-link self-center">
        Send a new code
      </Link>
    </form>
  );
}

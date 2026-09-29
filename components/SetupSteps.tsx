export type StepMark = { label: string; state: "done" | "current" | "todo" };

/**
 * "1 Event details · 2 Who can get in · 3 Event size": where you are in
 * setting up an event, shown on the create form and the setup screen so the
 * order is obvious. Done steps are green, the current one Klubbies blue.
 */
export function SetupSteps({ steps }: { steps: StepMark[] }) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:flex sm:flex-wrap sm:items-center" aria-label="Setup steps">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2"
          aria-current={step.state === "current" ? "step" : undefined}
        >
          {index > 0 ? <span className="hidden h-px w-8 bg-[color:var(--kb-line-strong)] sm:block" aria-hidden /> : null}
          <span
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[14px] font-semibold"
            style={
              step.state === "done"
                ? { background: "var(--kb-ok)", color: "#fff" }
                : step.state === "current"
                  ? { background: "var(--kb-brand)", color: "#fff" }
                  : { background: "var(--kb-sand)", color: "var(--kb-ink-2)", boxShadow: "inset 0 0 0 1px var(--kb-line-strong)" }
            }
            aria-hidden
          >
            {step.state === "done" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            ) : (
              index + 1
            )}
          </span>
          <span className={`text-[14px] ${step.state === "current" ? "font-semibold text-[color:var(--kb-ink)]" : "text-[color:var(--kb-ink-2)]"}`}>
            {step.label}
            <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "current" ? " (current step)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A green tick, a blue number for the next step, or a grey number for later. */
export function StepTick({ done, next, index }: { done: boolean; next: boolean; index: number }) {
  return (
    <span
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-semibold"
      style={
        done
          ? { background: "var(--kb-ok)", color: "#fff" }
          : next
            ? { background: "var(--kb-brand)", color: "#fff" }
            : { background: "var(--kb-sand)", color: "var(--kb-ink-2)" }
      }
      aria-hidden
    >
      {done ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      ) : (
        index
      )}
    </span>
  );
}

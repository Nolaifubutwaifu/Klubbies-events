import type { ReactNode } from "react";

/**
 * A section that folds away: the title is always visible, the rest opens on
 * tap. For information that's useful but not needed every visit (the activity
 * log, what a link can do, each settings group). Native details/summary, so
 * it works without JavaScript and is announced as expandable.
 */
export function Disclosure({
  title,
  hint,
  children,
  defaultOpen = false,
  id,
  className = "soft-card",
}: {
  title: ReactNode;
  /** One line under the title, visible while closed. */
  hint?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <details id={id} className={`kb-disclosure group ${className}`} open={defaultOpen || undefined}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-[16px] font-semibold">{title}</span>
          {hint ? <span className="text-[14px] font-normal text-[color:var(--kb-ink-3)]">{hint}</span> : null}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-none text-[color:var(--kb-ink-3)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>
    </details>
  );
}

import type { ReactNode } from "react";
import { Brand } from "@/components/ui";

type Tone = "info" | "ok" | "warn";

const BADGE: Record<Tone, { className: string; icon: ReactNode }> = {
  info: {
    className: "bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
  },
  ok: { className: "bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]", icon: <path d="M5 12.5l4.5 4.5L19 7" /> },
  warn: {
    className: "bg-[color:var(--kb-warn-tint)] text-[color:var(--kb-warn)]",
    icon: (
      <>
        <path d="M12 3l9.5 17h-19z" />
        <path d="M12 10v4M12 17.5v.5" />
      </>
    ),
  },
};

/**
 * The one-message pages: unsubscribe, account deleted, not found and errors.
 * A plain bar with the brand, then one card in the middle of paper.
 */
export function NoticePage({
  badge,
  eyebrow,
  eyebrowTone = "info",
  kicker,
  title,
  children,
  actions,
}: {
  badge?: Tone;
  eyebrow?: string;
  eyebrowTone?: "info" | "warn";
  /** A small mono line above everything, like "Error 404". */
  kicker?: string;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="theme-soft kb-branded flex min-h-[100dvh] flex-1 flex-col bg-[color:var(--kb-cream)]">
      <header className="flex h-16 flex-none items-center border-b border-[color:var(--kb-line)] px-5 sm:px-7">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:p-12">
        <div className="flex w-full max-w-[460px] flex-col items-start gap-[18px]">
          {badge ? (
            <span className={`flex h-14 w-14 items-center justify-center rounded-[14px] ${BADGE[badge].className}`} aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={badge === "ok" ? 2.2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
                {BADGE[badge].icon}
              </svg>
            </span>
          ) : null}
          {kicker ? <span className="mono text-[15px] text-[color:var(--kb-ink-3)]">{kicker}</span> : null}
          {eyebrow ? <span className={`kb-eyebrow ${eyebrowTone === "warn" ? "!text-[color:var(--kb-warn)]" : ""}`}>{eyebrow}</span> : null}
          <h1 className="serif text-[40px] leading-[1.05] sm:text-[44px]">{title}</h1>
          {children ? <div className="flex flex-col gap-3 text-[16px] text-[color:var(--kb-ink-2)]">{children}</div> : null}
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </main>
    </div>
  );
}

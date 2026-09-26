import Link from "next/link";
import type { ReactNode } from "react";

/** The product's own mark: a small ink tile and the name. */
export function Brand({ href = "/", size = 17 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink no-underline" aria-label="Klubbies Events home">
      <BrandTile size={Math.round(size * 1.45)} />
      <span className="font-semibold tracking-[-0.02em]" style={{ fontSize: size }}>
        Klubbies <span className="font-normal text-[color:var(--kb-ink-3)]">Events</span>
      </span>
    </Link>
  );
}

export function BrandTile({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="flex-none">
      <rect width="64" height="64" rx="14" fill="#16181d" />
      <path d="M19 15h8v15l11.5-15h9.5L35 30.5 48.5 49H39l-12-16.5V49h-8z" fill="#f7f7f5" />
      <circle cx="48" cy="16" r="5" fill="#5b78f0" />
    </svg>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`soft-chip ${className}`}>{children}</span>;
}

/** Page heading for the organiser screens: Geist, dense, one line of help. */
export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {kicker ? <span className="kb-eyebrow">{kicker}</span> : null}
      <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[30px]">{title}</h1>
      {children ? <p className="max-w-[64ch] text-[15px] text-[color:var(--kb-ink-2)]">{children}</p> : null}
    </div>
  );
}

/** No blank screens: an illustration, one sentence, one action. */
export function EmptyState({
  title,
  children,
  action,
  art,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="soft-dashed flex flex-col items-start gap-2 p-6">
      {art ? <span className="text-[color:var(--kb-ink-3)]">{art}</span> : null}
      <span className="text-[17px] font-semibold">{title}</span>
      {children ? <span className="max-w-[52ch] text-[14px] text-[color:var(--ink-70)]">{children}</span> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function StatusTag({ status, firstSeenAt }: { status: string; firstSeenAt?: string | null }) {
  if (status === "revoked") return <span className="soft-chip soft-chip-muted">Removed</span>;
  if (status === "active" || firstSeenAt) return <span className="soft-chip">Joined</span>;
  return <span className="soft-chip soft-chip-muted">Not joined yet</span>;
}

/**
 * One figure on the committee dashboard. `hint` carries the movement under it
 * — the thing that makes a number worth looking at.
 */
export function Stat({
  value,
  label,
  hint,
  tone = "plain",
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  tone?: "plain" | "good" | "attention";
}) {
  const hintColour =
    tone === "good" ? "text-[#1f6b3a]" : tone === "attention" ? "text-[#b42318]" : "text-[color:var(--ink-55)]";
  return (
    <div className="soft-card flex flex-col gap-1.5 p-4">
      <span className="text-[14px] text-[color:var(--ink-70)]">{label}</span>
      <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</span>
      {hint ? <span className={`text-[14px] font-medium ${hintColour}`}>{hint}</span> : null}
    </div>
  );
}

export function Placeholder({ seed, className = "" }: { seed: string; className?: string }) {
  const tones = ["#ecebe7", "#e4e3de", "#efeeea", "#e8e7e2", "#dfded8", "#f0efeb"];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return <div className={className} style={{ background: tones[hash % tones.length] }} aria-hidden />;
}

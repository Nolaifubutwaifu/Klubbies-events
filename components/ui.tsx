import Link from "next/link";
import type { ReactNode } from "react";

export function Brand({ href = "/", size = 20 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="soft-wordmark text-ink no-underline" style={{ fontSize: size }}>
      klubbies
    </Link>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`soft-chip ${className}`}>{children}</span>;
}

/**
 * Page heading for the committee screens. The kicker is the club name, so it
 * reads as a chip rather than the old all-caps label.
 */
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
    <div className="flex flex-col items-start gap-2">
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <h1 className="font-[family-name:var(--kb-font-display)] text-[32px] font-bold leading-[1.08] sm:text-[40px]">{title}</h1>
      {children ? <p className="max-w-[60ch] text-[16px] text-[color:var(--kb-ink-2)]">{children}</p> : null}
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
    <div className="soft-dashed flex flex-col items-start gap-3 p-7">
      {art ? <span className="text-accent-400">{art}</span> : null}
      <span className="soft-display text-[20px]">{title}</span>
      {children ? <span className="max-w-[46ch] text-[14px] text-[color:var(--ink-70)]">{children}</span> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function StatusTag({ status, role, graceEndsAt }: { status: string; role?: string; graceEndsAt?: string | null }) {
  if (status === "grace") {
    const ends = graceEndsAt ? new Date(graceEndsAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "";
    return <span className="soft-chip">Leaving{ends ? ` · ${ends}` : ""}</span>;
  }
  if (status === "revoked") return <span className="soft-chip soft-chip-muted">Removed</span>;
  if (role === "club_admin") return <span className="soft-chip">Admin</span>;
  if (status === "active") return <span className="soft-chip soft-chip-muted">Active</span>;
  return <span className="soft-chip soft-chip-muted">Never logged in</span>;
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
    tone === "good" ? "text-[#2f6b36]" : tone === "attention" ? "text-accent-700" : "text-[color:var(--ink-55)]";
  return (
    <div className="soft-card flex flex-col gap-1 p-4">
      <span className="text-[14px] text-[color:var(--ink-70)]">{label}</span>
      <span className="soft-display text-[clamp(26px,3vw,32px)] leading-none">{value}</span>
      {hint ? <span className={`text-[14px] font-bold ${hintColour}`}>{hint}</span> : null}
    </div>
  );
}

export function Placeholder({ seed, className = "" }: { seed: string; className?: string }) {
  const tones = [
    "color-mix(in srgb, var(--color-accent) 18%, var(--color-surface))",
    "color-mix(in srgb, var(--color-accent) 30%, var(--color-surface))",
    "color-mix(in srgb, var(--color-accent-2) 22%, var(--color-surface))",
    "var(--color-neutral-300)",
    "color-mix(in srgb, var(--color-accent) 10%, var(--color-neutral-200))",
    "var(--color-neutral-400)",
  ];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return <div className={className} style={{ background: tones[hash % tones.length] }} aria-hidden />;
}

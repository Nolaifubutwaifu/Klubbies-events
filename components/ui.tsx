import Link from "next/link";
import type { ReactNode } from "react";

/** The product's own mark: stacked album prints and the name. */
export function Brand({ href = "/", size = 17, tone = "dark" }: { href?: string; size?: number; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 no-underline ${light ? "text-white" : "text-ink"}`} aria-label="Klubbies Events home">
      <BrandTile size={Math.round(size * 1.45)} tone={tone} />
      <span className="font-semibold tracking-[-0.02em]" style={{ fontSize: size }}>
        Klubbies <span className={`font-normal ${light ? "text-[color:var(--kb-night-ink)]" : "text-[color:var(--kb-ink-3)]"}`}>Events</span>
      </span>
    </Link>
  );
}

/**
 * Stacked album prints, the same drawing as app/icon.svg. The tile is night
 * (#0E1424), which is also the footer, so that surface gets a hairline or the
 * edge disappears. The artwork stays this colour either way: it is not a
 * letter that can turn over.
 */
export function BrandTile({ size = 24, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden
      className="flex-none"
      style={light ? { borderRadius: (size * 112) / 512, boxShadow: "0 0 0 1px #2a3350" } : undefined}
    >
      <rect width="512" height="512" rx="112" fill="#0E1424" />
      <rect x="160" y="138" width="180" height="214" rx="22" fill="#B3C1F6" transform="rotate(-14 250 245)" />
      <path
        d="M206 168h140a22 22 0 0 1 22 22v170a22 22 0 0 1-22 22H206a22 22 0 0 1-22-22V190a22 22 0 0 1 22-22z M222 196a10 10 0 0 0-10 10v108a10 10 0 0 0 10 10h108a10 10 0 0 0 10-10V206a10 10 0 0 0-10-10z"
        fill="#F7F7F5"
        fillRule="evenodd"
      />
      <rect x="212" y="196" width="128" height="128" rx="10" fill="#2B4ACB" />
      <circle cx="276" cy="260" r="30" fill="#F7F7F5" />
    </svg>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`soft-chip ${className}`}>{children}</span>;
}

/** Page heading for the organiser screens: Geist, dense, one line of help.
    The event's name sits in the top bar's breadcrumb from 1024px, so the
    kicker above the title only shows on smaller screens. */
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
      {kicker ? <span className="kb-eyebrow lg:hidden">{kicker}</span> : null}
      <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[30px]">{title}</h1>
      {children ? <p className="max-w-[64ch] text-[15px] text-[color:var(--kb-ink-2)]">{children}</p> : null}
    </div>
  );
}

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

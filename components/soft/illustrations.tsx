/** Line illustrations for the soft theme's empty states. Accent-aware, decorative. */

export function PhotoStackArt({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 100) / 120} viewBox="0 0 120 100" fill="none" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <rect x="14" y="26" width="52" height="56" rx="7" transform="rotate(-9 40 54)" fill="var(--color-surface)" opacity="0.7" />
        <rect x="52" y="22" width="52" height="56" rx="7" transform="rotate(7 78 50)" fill="var(--color-surface)" opacity="0.85" />
        <rect x="34" y="30" width="54" height="58" rx="7" fill="var(--color-surface)" />
        <path d="M40 72l12-13 9 9 7-7 11 11" />
        <circle cx="52" cy="46" r="5" />
      </g>
    </svg>
  );
}

/** Confetti burst, for "nothing here yet" on a whole page. */
export function ConfettiArt({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 90) / 150} viewBox="0 0 150 90" fill="none" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M22 62c6-16 18-26 34-30" opacity="0.7" />
        <path d="M118 58c-4-15-14-25-29-30" opacity="0.7" />
        <path d="M60 14v-8M44 22l-5-6M78 22l5-6" />
        <path d="M14 34l7 3M136 34l-7 3" opacity="0.6" />
      </g>
      <g fill="currentColor">
        <circle cx="70" cy="46" r="7" />
        <rect x="34" y="52" width="9" height="9" rx="2.5" transform="rotate(-18 38 56)" opacity="0.8" />
        <rect x="100" y="48" width="9" height="9" rx="2.5" transform="rotate(22 104 52)" opacity="0.8" />
        <circle cx="52" cy="72" r="4.5" opacity="0.6" />
        <circle cx="94" cy="74" r="4" opacity="0.6" />
        <circle cx="124" cy="66" r="3.5" opacity="0.45" />
      </g>
    </svg>
  );
}

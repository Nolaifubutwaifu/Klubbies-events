"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      Print
    </button>
  );
}

/** The quiet version, for the legal pages' title band. */
export function PrintLink() {
  return (
    <button type="button" className="flex min-h-[44px] items-center gap-2 font-semibold text-[color:var(--kb-brand-deep)]" onClick={() => window.print()}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />
      </svg>
      Print
    </button>
  );
}

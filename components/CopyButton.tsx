"use client";

import { useState } from "react";

/** Copies a value and says so for two seconds. */
export function CopyButton({ value, label = "Copy", className = "btn btn-secondary" }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this", value);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

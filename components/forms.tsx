"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText,
  className = "btn btn-primary",
  disabled,
}: {
  children: ReactNode;
  pendingText?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { error?: string; message?: string } | undefined }) {
  if (state?.error) {
    return (
      <div className="notice" role="alert">
        {state.error}
      </div>
    );
  }
  if (state?.message) {
    return (
      <div className="border-l-4 border-ink bg-neutral-100 px-4 py-3 text-[14px]" role="status">
        {state.message}
      </div>
    );
  }
  return null;
}

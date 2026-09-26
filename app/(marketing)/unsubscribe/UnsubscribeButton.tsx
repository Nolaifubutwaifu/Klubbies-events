"use client";

import { useTransition } from "react";
import type { NotifyKind } from "@/lib/notify";
import { unsubscribeAction } from "./actions";

export function UnsubscribeButton({
  userId,
  kind,
  token,
  label,
}: {
  userId: string;
  kind: NotifyKind;
  token: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-primary btn-lg self-start"
      disabled={pending}
      onClick={() => startTransition(() => unsubscribeAction(userId, kind, token))}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

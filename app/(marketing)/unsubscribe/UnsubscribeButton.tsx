"use client";

import { useTransition } from "react";
import type { NotifyKind } from "@/lib/notify";
import { optOutOfAnnouncementsAction, unsubscribeAction } from "./actions";

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

export function AnnouncementOptOutButton({ eventId, email, token }: { eventId: string; email: string; token: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-primary btn-lg self-start"
      disabled={pending}
      onClick={() => startTransition(() => optOutOfAnnouncementsAction(eventId, email, token))}
    >
      {pending ? "Saving…" : "Stop these emails"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { enrolStatusAction } from "@/app/(app)/face-actions";

/**
 * Keeps the "Looking now" card honest. Every few seconds it asks whether the
 * selfie has been read (which also nudges the queue along), and refreshes the
 * page the moment it has, so nobody has to know to reload.
 */
export function LookingNow({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const result = await enrolStatusAction(eventId).catch(() => null);
      if (stopped) return;
      // Two failed checks in a row: say so instead of "checking" forever.
      failures = result ? 0 : failures + 1;
      setOffline(failures >= 2);
      const status = result?.status ?? "pending";
      if (status !== "pending") {
        router.refresh();
        return;
      }
      timer = setTimeout(tick, 4000);
    };
    timer = setTimeout(tick, 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [eventId, router]);

  return (
    <span className="flex items-center gap-2 text-[14px] font-medium text-[color:var(--kb-ink-3)]" role="status">
      <span className="kb-pulse" aria-hidden />
      {offline ? "Lost connection, still trying…" : "Checking for matches"}
    </span>
  );
}

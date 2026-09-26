"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { enrolStatusAction } from "@/app/(app)/face-actions";

/**
 * Keeps the "Looking now" card honest. Every few seconds it asks whether the
 * selfie has been read (which also nudges the queue along), and refreshes the
 * page the moment it has, so nobody has to know to reload.
 */
export function LookingNow({ clubId }: { clubId: string }) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const { status } = await enrolStatusAction(clubId).catch(() => ({ status: "pending" as const }));
      if (stopped) return;
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
  }, [clubId, router]);

  return (
    <span className="flex items-center gap-2 text-[14px] font-medium text-[color:var(--kb-ink-3)]" role="status">
      <span className="kb-pulse" aria-hidden />
      Checking for matches
    </span>
  );
}

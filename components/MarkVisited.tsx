"use client";

import { useEffect } from "react";
import { markClubVisitedAction } from "@/app/(app)/c/[handle]/actions";

/**
 * Records that the member opened this club, once per mount and after paint.
 * Deliberately not done during render: the page needs the *previous* visit
 * time to work out which albums are new.
 */
export function MarkVisited({ clubId }: { clubId: string }) {
  useEffect(() => {
    void markClubVisitedAction(clubId);
  }, [clubId]);

  return null;
}

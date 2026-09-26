"use client";

import { useEffect } from "react";
import { markEventVisitedAction } from "@/app/(app)/e/[handle]/actions";

/**
 * Records that the member opened this event, once per mount and after paint.
 * Deliberately not done during render: the page needs the *previous* visit
 * time to work out which albums are new.
 */
export function MarkVisited({ eventId }: { eventId: string }) {
  useEffect(() => {
    void markEventVisitedAction(eventId);
  }, [eventId]);

  return null;
}

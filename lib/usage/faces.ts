import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Counts Rekognition calls against their event, for the usage view's cost
 * figures (pricing handoff §5.8). Never throws: a missed count is a rounding
 * error, a failed face job is not.
 */
export async function countFaceCalls(eventId: string, calls: number): Promise<void> {
  if (calls <= 0) return;
  const { error } = await createAdminClient().rpc("count_face_calls", { p_event_id: eventId, p_calls: calls });
  if (error) console.error("could not count face calls", eventId, error);
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Recomputes every event's usage totals (migration 30). Returns how many rows it wrote. */
export async function refreshUsage(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("refresh_event_usage");
  if (error) throw error;
  return data ?? 0;
}

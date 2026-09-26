import "server-only";
import { EXPIRE_AFTER_DAYS } from "@/lib/media/constants";
import { derivativePaths, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export type UnfinishedSweepResult = { expired: number };

/**
 * Clears uploads that never finished. They are invisible to members, counted
 * nowhere a member looks, and until now lived for ever: the first real club
 * had four sitting in an album for two days while the dashboard said nothing
 * needed doing. The dashboard now lists them after an hour; this removes the
 * ones nobody fixed within two weeks, stored objects and all.
 */
export async function runUnfinishedSweep(now = new Date()): Promise<UnfinishedSweepResult> {
  const admin = createAdminClient();
  const cutoff = new Date(now.getTime() - EXPIRE_AFTER_DAYS * 86_400_000).toISOString();
  const { data } = await admin
    .from("media")
    .select("id, storage_path")
    .neq("status", "ready")
    .lt("created_at", cutoff)
    .limit(500);
  const rows = data ?? [];
  if (rows.length === 0) return { expired: 0 };

  // Derivative paths aren't recorded until finalize, which never ran, so
  // remove whatever the browser may have written beside the original.
  await removeObjects(
    rows.flatMap((row) => {
      const folder = row.storage_path.slice(0, row.storage_path.lastIndexOf("/"));
      const paths = derivativePaths(folder);
      return [row.storage_path, paths.thumb, paths.display, paths.poster];
    }),
  );
  const { error } = await admin
    .from("media")
    .delete()
    .in("id", rows.map((row) => row.id))
    .neq("status", "ready"); // finished in the meantime: leave it alone
  if (error) throw error;
  return { expired: rows.length };
}

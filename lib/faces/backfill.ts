import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Enabling the feature queues the club's whole library, newest first, so
// recent events light up before old ones.
//
// This is deliberately not a Rekognition call. It only writes rows; the drain
// does the spending, and scripts/backfill-faces.ts is how a large library
// should do its first pass.

/**
 * Bulk-queueing cannot use `on_conflict`.
 *
 * face_jobs_media_live_idx is a PARTIAL unique index — it only covers jobs
 * that are still pending or running, which is the whole point: a photo whose
 * job finished must be queueable again for a rematch. Postgres will not infer
 * ON CONFLICT from a partial index unless the statement repeats its predicate,
 * which PostgREST cannot express, so an upsert here fails outright with 42P10.
 *
 * So: ask which photos already have a live job, skip those, and insert the
 * rest. The index is still the real guard — if another drain queues the same
 * photo between the read and the write, the chunk comes back 23505 and we
 * fall back to inserting it row by row, where a duplicate is simply skipped.
 */
async function queueMediaJobs(
  admin: ReturnType<typeof createAdminClient>,
  clubId: string,
  mediaIds: string[],
  kind: "index_media" | "rematch_media" = "index_media",
): Promise<number> {
  const { data: live } = await admin
    .from("face_jobs")
    .select("media_id")
    .eq("club_id", clubId)
    .eq("kind", kind)
    .in("status", ["pending", "running"]);
  const alreadyQueued = new Set((live ?? []).map((row) => row.media_id));
  const todo = mediaIds.filter((id) => !alreadyQueued.has(id));

  let queued = 0;
  for (let i = 0; i < todo.length; i += 500) {
    const chunk = todo.slice(i, i + 500).map((id) => ({ club_id: clubId, media_id: id, kind }));
    const { error } = await admin.from("face_jobs").insert(chunk);
    if (!error) {
      queued += chunk.length;
      continue;
    }
    if (error.code !== "23505") throw error;
    for (const row of chunk) {
      const { error: rowError } = await admin.from("face_jobs").insert(row);
      if (!rowError) queued += 1;
      else if (rowError.code !== "23505") throw rowError;
    }
  }
  return queued;
}

export type BackfillQueueResult = { queued: number };

export async function queueClubBackfill(clubId: string): Promise<BackfillQueueResult> {
  const admin = createAdminClient();

  // Supabase JS has no insert-select, so the ids come back first. Chunked,
  // because a single insert of 50,000 rows is a request nobody enjoys.
  const { data: photos, error } = await admin
    .from("media")
    .select("id")
    .eq("club_id", clubId)
    .eq("status", "ready")
    .eq("kind", "photo")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const queued = await queueMediaJobs(
    admin,
    clubId,
    (photos ?? []).map((photo) => photo.id),
  );

  await admin
    .from("club_face_settings")
    .update({
      backfill_status: "queued",
      backfill_queued_at: new Date().toISOString(),
      backfill_completed_at: null,
    })
    .eq("club_id", clubId);

  return { queued };
}

export type BackfillProgress = { total: number; remaining: number; status: string };

export async function backfillProgress(clubId: string): Promise<BackfillProgress> {
  const admin = createAdminClient();
  const [{ count: total }, { count: remaining }, { data: settings }] = await Promise.all([
    admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "ready")
      .eq("kind", "photo"),
    admin
      .from("face_jobs")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .in("status", ["pending", "running"]),
    admin.from("club_face_settings").select("backfill_status").eq("club_id", clubId).maybeSingle(),
  ]);
  return { total: total ?? 0, remaining: remaining ?? 0, status: settings?.backfill_status ?? "idle" };
}

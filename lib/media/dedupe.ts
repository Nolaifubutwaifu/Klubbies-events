import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/db/types";

/** What lib/media/content-hash.ts produces: hex SHA-256, "s:" when sampled. */
export const contentHashSchema = z
  .string()
  .regex(/^(s:)?[0-9a-f]{64}$/)
  .nullish()
  .transform((value) => value ?? null);

export type ExistingUpload = { id: string; status: string; storagePath: string; guestLinkId: string | null };

/**
 * The row this album already has for this exact file, if any.
 *
 * A ready row means there is nothing to do. A row still "processing" is an
 * upload that never finished — usually the very file being dropped again to
 * fix it — so the caller resumes into that row instead of adding a second.
 */
export async function findExistingUpload(
  client: SupabaseClient<Database>,
  albumId: string,
  contentHash: string | null,
): Promise<ExistingUpload | null> {
  if (!contentHash) return null;
  const { data } = await client
    .from("media")
    .select("id, status, storage_path, guest_link_id")
    .eq("album_id", albumId)
    .eq("content_hash", contentHash)
    .limit(1)
    .maybeSingle();
  return data
    ? { id: data.id, status: data.status, storagePath: data.storage_path, guestLinkId: data.guest_link_id }
    : null;
}

/** Postgres unique_violation: another request inserted the same file first. */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

import "server-only";
import { deleteEventEverywhere } from "@/lib/events/delete";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recently deleted (docs/handoff-retention-backups.md, phase 1).
 *
 * An organiser's delete only stamps deleted_at; RLS then hides the row from
 * everyone. This file holds what happens after: the permanent delete, used by
 * "Delete now" in the bin and by the hourly purge 30 days later.
 *
 * Deletions someone asked for (account deletion, a confirmed removal request,
 * turning face search off) never come through here: they stay immediate.
 */

export const BIN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The last moment something deleted at `deletedAt` can be restored. */
export function restorableUntil(deletedAt: string | Date): Date {
  return new Date(new Date(deletedAt).getTime() + BIN_DAYS * DAY_MS);
}

type MediaFiles = { storage_path: string; thumb_path: string | null; display_path: string | null; poster_path: string | null };

function filesOf(rows: MediaFiles[]): string[] {
  return rows.flatMap((m) => [m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p)));
}

/**
 * Deletes media rows and their files for good. Deleting the rows cascades
 * their media_faces, whose trigger queues each faceprint; the caller drains
 * that queue once at the end.
 */
export async function purgeMedia(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const admin = createAdminClient();
  let purged = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const { data: rows } = await admin
      .from("media")
      .select("id, storage_path, thumb_path, display_path, poster_path")
      .in("id", ids.slice(i, i + 500));
    const batch = rows ?? [];
    if (batch.length === 0) continue;
    await removeObjects(filesOf(batch));
    const { error } = await admin.from("media").delete().in("id", batch.map((m) => m.id));
    if (error) throw error;
    purged += batch.length;
  }
  return purged;
}

/** Deletes an album for good: every photo in it, its cover file, then the row. */
export async function purgeAlbum(albumId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: album } = await admin.from("albums").select("id, cover_path").eq("id", albumId).maybeSingle();
  if (!album) return;
  for (;;) {
    const { data: batch } = await admin.from("media").select("id").eq("album_id", albumId).limit(500);
    if (!batch || batch.length === 0) break;
    await purgeMedia(batch.map((m) => m.id));
  }
  const { error } = await admin.from("albums").delete().eq("id", albumId);
  if (error) throw error;
  if (album.cover_path) {
    await removeObjects([album.cover_path]).catch((removeError) => console.error("could not remove cover of purged album", albumId, removeError));
  }
}

export type BinPurgeResult = { events: number; albums: number; media: number };

/**
 * The hourly pass: anything in the bin for more than 30 days is deleted for
 * good, whole events first, then albums, then photos binned on their own. It
 * stops starting new work once `budgetMs` is spent, so the face jobs after it
 * still get their share of the run; whatever is left waits an hour.
 */
export async function runBinPurge(now = new Date(), budgetMs = 60_000): Promise<BinPurgeResult> {
  const admin = createAdminClient();
  const cutoff = new Date(now.getTime() - BIN_DAYS * DAY_MS).toISOString();
  const deadline = Date.now() + budgetMs;
  const result: BinPurgeResult = { events: 0, albums: 0, media: 0 };

  const { data: events } = await admin.from("events").select("id").lt("deleted_at", cutoff).order("deleted_at").limit(10);
  for (const event of events ?? []) {
    if (Date.now() > deadline) return result;
    try {
      await deleteEventEverywhere(event.id);
      result.events += 1;
    } catch (error) {
      console.error("bin purge: event", event.id, error);
    }
  }

  const { data: albums } = await admin.from("albums").select("id").lt("deleted_at", cutoff).order("deleted_at").limit(50);
  for (const album of albums ?? []) {
    if (Date.now() > deadline) break;
    try {
      await purgeAlbum(album.id);
      result.albums += 1;
    } catch (error) {
      console.error("bin purge: album", album.id, error);
    }
  }

  if (Date.now() <= deadline) {
    const { data: media } = await admin.from("media").select("id").lt("deleted_at", cutoff).order("deleted_at").limit(2000);
    try {
      result.media = await purgeMedia((media ?? []).map((m) => m.id));
    } catch (error) {
      console.error("bin purge: media", error);
    }
  }

  if (result.albums || result.media) {
    await drainFacePurgeQueue().catch((error) => console.error("face purge after bin purge", error));
  }
  return result;
}

export type BinnedEvent = { id: string; name: string; handle: string; deletedAt: string };

/**
 * Binned events this person can restore: they run the event (or run the
 * platform). Read with the service role, because RLS hides binned events from
 * everyone; the membership check here is the authorisation.
 */
export async function listBinnedEventsFor(userId: string): Promise<BinnedEvent[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("memberships")
    .select("role, event_roles(manage_event), events!inner(id, name, handle, deleted_at)")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("events.deleted_at", "is", null);
  return (data ?? [])
    .filter((m) => m.role === "event_admin" || Boolean(m.event_roles?.manage_event))
    .map((m) => ({ id: m.events.id, name: m.events.name, handle: m.events.handle, deletedAt: m.events.deleted_at as string }))
    .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
}

/** Whether this person may restore or purge a binned event. */
export async function canRestoreEvent(eventId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin
      .from("memberships")
      .select("role, event_roles(manage_event)")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    admin.from("users").select("is_super_admin").eq("id", userId).maybeSingle(),
  ]);
  if (profile?.is_super_admin) return true;
  return Boolean(membership && (membership.role === "event_admin" || membership.event_roles?.manage_event));
}

/**
 * The album or event a delete just redirected about (?deleted=<id>), if it is
 * in the bin and was deleted in the last minute, for the Undo bar. The caller
 * has already checked the viewer runs the event.
 */
export async function recentlyDeleted(
  table: "albums" | "events",
  id: string | string[] | undefined,
  eventId?: string,
): Promise<{ id: string; name: string } | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const since = new Date(Date.now() - 60_000).toISOString();
  const admin = createAdminClient();
  if (table === "albums") {
    const { data } = await admin
      .from("albums")
      .select("id, title")
      .eq("id", id)
      .eq("event_id", eventId ?? "")
      .gt("deleted_at", since)
      .maybeSingle();
    return data ? { id: data.id, name: data.title } : null;
  }
  const { data } = await admin.from("events").select("id, name").eq("id", id).gt("deleted_at", since).maybeSingle();
  return data ? { id: data.id, name: data.name } : null;
}

import "server-only";
import { sendDeletionWarning } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { deleteEventFaceData } from "@/lib/faces/purge-event";
import { formatLongDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireEventPhotos } from "./expire";

const DAY_MS = 24 * 3600 * 1000;

export type RetentionResult = { warned: number; faceDataClosed: number; expired: number };

async function organiserEmails(eventId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("memberships")
    .select("role, event_roles(manage_event), users!inner(email)")
    .eq("event_id", eventId)
    .eq("status", "active")
    .not("user_id", "is", null);
  return (data ?? []).filter((m) => m.role === "event_admin" || m.event_roles?.manage_event).map((m) => m.users.email);
}

async function warn(event: { id: string; name: string; handle: string; photos_delete_at: string }, now: Date): Promise<void> {
  const admin = createAdminClient();
  const { data: albums } = await admin
    .from("albums")
    .select("id, title")
    .eq("event_id", event.id)
    .is("deleted_at", null)
    .order("created_at");
  const daysLeft = Math.max(1, Math.ceil((new Date(event.photos_delete_at).getTime() - now.getTime()) / DAY_MS));
  const props = {
    eventName: event.name,
    deletesOn: formatLongDate(event.photos_delete_at),
    daysLeft,
    // Signed-in organisers download each album as a zip from these.
    albums: (albums ?? []).map((a) => ({ title: a.title, url: `${appUrl()}/api/albums/${a.id}/zip` })),
    billingUrl: `${appUrl()}/admin/${event.handle}/billing#keep`,
  };
  for (const email of await organiserEmails(event.id)) {
    await sendDeletionWarning(email, props).catch((error) => console.error("deletion warning failed", event.id, error));
  }
}

/**
 * The hourly pass for the 12 month deletion (retention handoff, phase 3):
 *
 *   1. warns organisers 30 and 7 days before an event's photos go;
 *   2. deletes the face data of galleries that have closed, as the privacy
 *      page promises (within 24 hours of access ending);
 *   3. deletes the photos of events whose date has come.
 *
 * Each warning is claimed by stamping it first, so a run that dies halfway
 * never sends a second copy.
 */
export async function runRetentionJob(budgetMs: number, now = new Date()): Promise<RetentionResult> {
  const admin = createAdminClient();
  const deadline = Date.now() + budgetMs;
  const result: RetentionResult = { warned: 0, faceDataClosed: 0, expired: 0 };
  const iso = now.toISOString();

  // 1. Warnings. Within 7 days, the 7 day one only (and the 30 counts as sent).
  const in30 = new Date(now.getTime() + 30 * DAY_MS).toISOString();
  const { data: due } = await admin
    .from("events")
    .select("id, name, handle, photos_delete_at, deletion_warned_30_at, deletion_warned_7_at")
    .is("photos_deleted_at", null)
    .is("deleted_at", null)
    .gt("photos_delete_at", iso)
    .lte("photos_delete_at", in30)
    .or("deletion_warned_30_at.is.null,deletion_warned_7_at.is.null")
    .limit(200);
  for (const event of due ?? []) {
    if (!event.photos_delete_at) continue;
    const within7 = new Date(event.photos_delete_at).getTime() - now.getTime() <= 7 * DAY_MS;
    const column = within7 ? "deletion_warned_7_at" : "deletion_warned_30_at";
    if (event[column]) continue;
    const { data: claimed } = await admin
      .from("events")
      .update(within7 ? { deletion_warned_7_at: iso, deletion_warned_30_at: event.deletion_warned_30_at ?? iso } : { deletion_warned_30_at: iso })
      .eq("id", event.id)
      .is(column, null)
      .select("id");
    if (!claimed?.length) continue;
    await warn({ ...event, photos_delete_at: event.photos_delete_at }, now);
    result.warned += 1;
  }

  // 2. Galleries that have closed: their face data goes.
  const { data: closed } = await admin
    .from("events")
    .select("id")
    .lte("access_ends_at", iso)
    .is("face_data_closed_at", null)
    .is("photos_deleted_at", null)
    .limit(50);
  for (const event of closed ?? []) {
    if (Date.now() > deadline) return result;
    if (await deleteEventFaceData(event.id)) {
      await admin.from("events").update({ face_data_closed_at: iso }).eq("id", event.id);
      result.faceDataClosed += 1;
    }
  }

  // 3. Photos whose 12 months are up.
  const { data: expiring } = await admin
    .from("events")
    .select("id")
    .lte("photos_delete_at", iso)
    .is("photos_deleted_at", null)
    .order("photos_delete_at")
    .limit(10);
  for (const event of expiring ?? []) {
    if (Date.now() > deadline) break;
    try {
      await expireEventPhotos(event.id);
      result.expired += 1;
    } catch (error) {
      console.error("expiry failed", event.id, error);
    }
  }
  return result;
}

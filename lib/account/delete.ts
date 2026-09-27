import "server-only";
import { revokeProfile } from "@/lib/faces/enrol";
import { deleteEventCollection, drainFacePurgeQueue } from "@/lib/faces/purge";
import { BUCKET, logoMarkPath, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deleting your own account, which Apple requires any app with sign-in to
 * offer inside the app.
 *
 * What goes: the sign-in itself, profile and photo, favourites, face
 * recognition (selfie, faceprints and matches, deleted from AWS before this
 * returns), and this person's phones for push. An attendee who joined an
 * event through its link leaves that event's attendee list too: the address
 * was only there because they joined.
 *
 * What stays, because it belongs to the event rather than to the person:
 * photos they uploaded (the uploader is forgotten), their line on a guest
 * list the organiser imported (reset to "not joined yet"), and the event's
 * activity log, as the privacy policy says.
 *
 * An event can't be left without an organiser. If this person is its only
 * organiser and attendees have joined, they must make someone a co-organiser
 * first. If nobody else ever joined, the event closes with the account and
 * its photos are deleted.
 */

export type EventRef = { id: string; name: string; handle: string };
export type DeletionPlan = { handOver: EventRef[]; closes: EventRef[] };

type MembershipRow = {
  id: string;
  event_id: string;
  role: string | null;
  status: string;
  event_roles: { manage_event: boolean } | null;
  events: { id: string; name: string; handle: string; access_mode: string } | null;
};

function runsEvent(m: Pick<MembershipRow, "role" | "event_roles">): boolean {
  return Boolean(m.event_roles?.manage_event) || m.role === "event_admin";
}

export async function planAccountDeletion(userId: string): Promise<DeletionPlan> {
  const admin = createAdminClient();
  const { data: mine, error } = await admin
    .from("memberships")
    .select("id, event_id, role, status, event_roles(manage_event), events!inner(id, name, handle, access_mode)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;

  const plan: DeletionPlan = { handOver: [], closes: [] };
  for (const m of (mine ?? []) as unknown as MembershipRow[]) {
    if (!runsEvent(m) || !m.events) continue;
    const { data: others } = await admin
      .from("memberships")
      .select("id, role, event_roles(manage_event)")
      .eq("event_id", m.event_id)
      .eq("status", "active")
      .not("user_id", "is", null)
      .neq("id", m.id);
    const people = (others ?? []) as unknown as Pick<MembershipRow, "role" | "event_roles">[];
    if (people.some(runsEvent)) continue; // someone else already runs it
    const event = { id: m.events.id, name: m.events.name, handle: m.events.handle };
    if (people.length > 0) plan.handOver.push(event);
    else plan.closes.push(event);
  }
  return plan;
}

/** Closes an event nobody else has joined: face data, files, rows. */
async function closeEvent(eventId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id, logo_path").eq("id", eventId).maybeSingle();
  if (!event) return;

  const { data: settings } = await admin.from("event_face_settings").select("collection_id").eq("event_id", eventId).maybeSingle();
  if (settings?.collection_id) {
    await deleteEventCollection(settings.collection_id);
    await admin.from("face_purge_queue").delete().eq("collection_id", settings.collection_id);
  }

  const paths: string[] = [];
  const { data: media } = await admin.from("media").select("storage_path, thumb_path, display_path, poster_path").eq("event_id", eventId);
  for (const m of media ?? []) paths.push(...[m.storage_path, m.thumb_path, m.display_path, m.poster_path].filter((p): p is string => Boolean(p)));
  const { data: albums } = await admin.from("albums").select("cover_path").eq("event_id", eventId);
  for (const a of albums ?? []) if (a.cover_path) paths.push(a.cover_path);
  const { data: selfies } = await admin.from("member_face_profiles").select("selfie_path").eq("event_id", eventId);
  for (const s of selfies ?? []) if (s.selfie_path) paths.push(s.selfie_path);
  if (event.logo_path) paths.push(event.logo_path, logoMarkPath(event.logo_path));

  const { error } = await admin.from("events").delete().eq("id", eventId);
  if (error) throw error;
  await removeObjects(paths).catch((removeError) => console.error("could not remove files of closed event", eventId, removeError));
}

export type DeletionResult = { ok: true; closed: EventRef[] } | { ok: false; handOver: EventRef[] };

export async function deleteAccount(userId: string, email: string): Promise<DeletionResult> {
  const plan = await planAccountDeletion(userId);
  if (plan.handOver.length > 0) return { ok: false, handOver: plan.handOver };

  const admin = createAdminClient();
  for (const event of plan.closes) await closeEvent(event.id);

  // Face recognition first, so faceprints leave AWS before anything else goes.
  const { data: profiles } = await admin.from("member_face_profiles").select("id").eq("user_id", userId);
  for (const profile of profiles ?? []) await revokeProfile(profile.id);
  await drainFacePurgeQueue();

  const { data: memberships } = await admin
    .from("memberships")
    .select("id, status, role, events(access_mode)")
    .eq("user_id", userId);
  const rows = memberships ?? [];
  // Joined through an open link: the organiser never had this address.
  const joinedByLink = rows.filter((m) => m.role !== "event_admin" && m.events?.access_mode === "link").map((m) => m.id);
  if (joinedByLink.length) await admin.from("memberships").delete().in("id", joinedByLink);
  const kept = rows.filter((m) => !joinedByLink.includes(m.id));
  if (kept.length) {
    // Back to how the guest list looked before this person first signed in.
    await admin
      .from("memberships")
      .update({ claimed_name: null, name_mismatch: false, first_seen_at: null })
      .in("id", kept.map((m) => m.id));
    const liveIds = kept.filter((m) => m.status === "active").map((m) => m.id);
    if (liveIds.length) await admin.from("memberships").update({ status: "pending" }).in("id", liveIds);
  }

  // Profile photos live under avatars/<user id>/.
  const { data: avatars } = await admin.storage.from(BUCKET).list(`avatars/${userId}`, { limit: 100 });
  const avatarPaths = (avatars ?? []).map((object) => `avatars/${userId}/${object.name}`);
  if (avatarPaths.length) await removeObjects(avatarPaths).catch((error) => console.error("could not remove avatar", error));

  await admin.from("pending_sign_ins").delete().eq("email", email.toLowerCase());

  // Cascades to the profile row, favourites, face profiles and push devices;
  // memberships, uploads and logs keep their rows with the person unlinked.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  return { ok: true, closed: plan.closes };
}

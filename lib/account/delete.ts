import "server-only";
import { revokeProfile } from "@/lib/faces/enrol";
import { deleteEventEverywhere } from "@/lib/events/delete";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { BUCKET, removeObjects } from "@/lib/storage";
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
 * first. If nobody else ever joined, or the event is already in Recently
 * deleted, the event closes with the account and its photos are deleted.
 */

export type EventRef = { id: string; name: string; handle: string };
export type DeletionPlan = { handOver: EventRef[]; closes: EventRef[] };

type MembershipRow = {
  id: string;
  event_id: string;
  role: string | null;
  status: string;
  event_roles: { manage_event: boolean } | null;
  events: { id: string; name: string; handle: string; access_mode: string; deleted_at: string | null } | null;
};

function runsEvent(m: Pick<MembershipRow, "role" | "event_roles">): boolean {
  return Boolean(m.event_roles?.manage_event) || m.role === "event_admin";
}

export async function planAccountDeletion(userId: string): Promise<DeletionPlan> {
  const admin = createAdminClient();
  const { data: mine, error } = await admin
    .from("memberships")
    .select("id, event_id, role, status, event_roles(manage_event), events!inner(id, name, handle, access_mode, deleted_at)")
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
    // An event already in Recently deleted goes with the account: nobody else
    // could restore it, so there is nothing to hand over.
    if (people.length > 0 && !m.events.deleted_at) plan.handOver.push(event);
    else plan.closes.push(event);
  }
  return plan;
}

export type DeletionResult = { ok: true; closed: EventRef[] } | { ok: false; handOver: EventRef[] };

export async function deleteAccount(userId: string, email: string): Promise<DeletionResult> {
  const plan = await planAccountDeletion(userId);
  if (plan.handOver.length > 0) return { ok: false, handOver: plan.handOver };

  const admin = createAdminClient();
  for (const event of plan.closes) await deleteEventEverywhere(event.id);

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

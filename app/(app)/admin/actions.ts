"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getEventContextById, requireUser } from "@/lib/auth/session";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import type { Permission } from "@/lib/permissions";
import { graceWindow, sendDueGraceNotice } from "@/lib/membership/grace";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { notifyNewAlbum } from "@/lib/notify";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { generateHandleBase } from "@/lib/roster/handle";
import sharp from "sharp";
import { BUCKET, LOGO_MARK_SIZE, logoMarkPath, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean; message?: string };

async function adminContext(eventId: string) {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.isAdmin) throw new Error("Not authorised");
  return ctx;
}

/** Context for anyone holding a specific permission, not just full admins. */
async function permContext(eventId: string, perm: Permission) {
  const ctx = await getEventContextById(eventId);
  if (!ctx?.perms[perm]) throw new Error("Not authorised");
  return ctx;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const eventSchema = z.object({
  name: z.string().trim().min(2, "Give the event a name").max(120),
  organisation: z.string().trim().max(160),
  description: z.string().trim().max(1000),
});

export async function createEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser("/admin/new");
  const parsed = eventSchema.safeParse({
    name: text(form, "name"),
    organisation: text(form, "organisation"),
    description: text(form, "description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_name: parsed.data.name,
    p_handle_base: generateHandleBase(parsed.data.name),
    p_organisation: parsed.data.organisation,
    p_description: parsed.data.description,
  });
  if (error || !data) return { error: "Could not create the event. Try again." };

  redirect(`/admin/${data.handle}/billing?step=2`);
}

const eventSettingsSchema = eventSchema.extend({
  accentColour: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must look like #cf2e12")]),
});

export async function updateEventAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const parsed = eventSettingsSchema.safeParse({
    name: text(form, "name"),
    organisation: text(form, "organisation"),
    description: text(form, "description"),
    accentColour: text(form, "accentColour"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      organisation: parsed.data.organisation || null,
      description: parsed.data.description || null,
      accent_colour: parsed.data.accentColour || null,
    })
    .eq("id", eventId);
  if (error) return { error: "Could not save the settings" };
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Saved" };
}

/** The two event-wide switches the settings screen shows. */
export async function setEventPrivacyAction(
  eventId: string,
  prefs: { allow_removal_requests: boolean; grace_period_enabled: boolean },
): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_event");
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      allow_removal_requests: prefs.allow_removal_requests,
      grace_period_enabled: prefs.grace_period_enabled,
    })
    .eq("id", eventId);
  if (error) return { error: "Could not save that" };
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Saved" };
}

/**
 * Makes the 96px badge rendition beside an uploaded logo. Done here rather than
 * in the browser so SVG logos get one too. Best effort: without it the badge
 * falls back to the original, which is how every logo worked before.
 */
async function makeLogoMark(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  try {
    const { data: file } = await supabase.storage.from(BUCKET).download(path);
    if (!file) return;
    const mark = await sharp(Buffer.from(await file.arrayBuffer()), { density: 300 })
      .resize(LOGO_MARK_SIZE, LOGO_MARK_SIZE, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer();
    await supabase.storage
      .from(BUCKET)
      .upload(logoMarkPath(path), new Uint8Array(mark), { upsert: true, contentType: "image/webp" });
  } catch (markError) {
    console.error("could not make logo mark", path, markError);
  }
}

export async function setEventLogoAction(eventId: string, path: string | null): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  if (path !== null && !path.startsWith(`events/${eventId}/logo/`)) return { error: "Invalid logo path" };
  const supabase = await createClient();
  if (path) await makeLogoMark(supabase, path);
  const { error } = await supabase.from("events").update({ logo_path: path }).eq("id", eventId);
  if (error) return { error: "Could not save the logo" };
  // Each upload has its own name, so a replaced logo can't be served from a
  // cached URL. Clear the one it replaced, and its mark.
  const previous = ctx.event.logo_path;
  if (previous && previous !== path) {
    await removeObjects([previous, logoMarkPath(previous)]).catch((removeError) =>
      console.error("could not remove old logo", previous, removeError),
    );
  }
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const memberSchema = z.object({
  name: z.string().trim().min(1, "Enter the member's full name").max(200),
  email: z.string().transform(normaliseEmail).refine(isValidEmail, "Enter a valid email address"),
});

export async function addMemberAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  if (!canWrite(ctx.event.billing_status)) return { error: ACTIVATE_MESSAGE };
  const parsed = memberSchema.safeParse({ name: text(form, "name"), email: text(form, "email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("memberships")
    .select("id, status, user_id")
    .eq("event_id", eventId)
    .eq("roster_email", parsed.data.email)
    .maybeSingle();

  if (existing && (existing.status === "active" || existing.status === "pending")) {
    return { error: `${parsed.data.email} is already on the list` };
  }

  const now = new Date().toISOString();
  const { error } = existing
    ? await supabase
        .from("memberships")
        .update({
          status: existing.user_id ? "active" : "pending",
          grace_started_at: null,
          grace_ends_at: null,
          grace_notices_sent: 0,
          invited_at: now,
        })
        .eq("id", existing.id)
    : await supabase.from("memberships").insert({
        event_id: eventId,
        roster_email: parsed.data.email,
        roster_name: parsed.data.name,
        status: "pending",
        role: "event_member",
        invited_at: now,
      });
  if (error) return { error: "Could not add that member" };

  revalidatePath(`/admin/${ctx.event.handle}/members`);
  return { ok: true, message: existing ? `${parsed.data.name} is back on the list` : `${parsed.data.name} added` };
}

export async function removeMembersAction(eventId: string, membershipIds: string[]): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const ids = z.array(z.uuid()).min(1).max(1000).safeParse(membershipIds);
  if (!ids.success) return { error: "Select at least one member" };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("event_id", eventId)
    .in("id", ids.data)
    .in("status", ["pending", "active"]);
  const targets = rows ?? [];
  if (targets.some((m) => m.user_id === ctx.userId)) return { error: "You can't remove yourself" };

  if (targets.some((m) => m.role === "event_admin")) {
    const { count } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("role", "event_admin")
      .eq("status", "active");
    const removingAdmins = targets.filter((m) => m.role === "event_admin" && m.status === "active").length;
    if ((count ?? 0) - removingAdmins < 1) return { error: "A event needs at least one admin" };
  }

  // People who never signed in have nothing to keep, so they are revoked
  // straight away. Everyone else enters the 30 day grace window.
  const neverJoined = targets.filter((m) => m.user_id === null).map((m) => m.id);
  const joined = targets.filter((m) => m.user_id !== null).map((m) => m.id);
  const { startedAt, endsAt } = graceWindow();

  if (neverJoined.length) {
    await supabase.from("memberships").update({ status: "revoked" }).in("id", neverJoined);
  }
  if (joined.length) {
    await supabase
      .from("memberships")
      .update({ status: "grace", role: "event_member", grace_started_at: startedAt, grace_ends_at: endsAt, grace_notices_sent: 0 })
      .in("id", joined);

    after(async () => {
      const { data } = await createAdminClient()
        .from("memberships")
        .select("id, roster_email, roster_name, claimed_name, grace_started_at, grace_ends_at, grace_notices_sent, events!inner(name, handle)")
        .in("id", joined);
      for (const row of data ?? []) {
        await sendDueGraceNotice(row).catch((err) => console.error("grace notice failed", row.id, err));
      }
    });
  }

  revalidatePath(`/admin/${ctx.event.handle}/members`);
  return {
    ok: true,
    message: `${targets.length} removed. ${joined.length ? `${joined.length} keep access to earlier albums for 30 days.` : ""}`.trim(),
  };
}

export async function endGraceAction(eventId: string, membershipId: string, typedName: string): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("memberships")
    .select("id, roster_name, status")
    .eq("event_id", eventId)
    .eq("id", membershipId)
    .maybeSingle();
  if (!member || member.status !== "grace") return { error: "That member isn't in a grace period" };

  const clean = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (clean(typedName) !== clean(member.roster_name)) return { error: `Type ${member.roster_name} exactly to confirm` };

  const { error } = await supabase
    .from("memberships")
    .update({ status: "revoked", grace_ends_at: new Date().toISOString() })
    .eq("id", member.id);
  if (error) return { error: "Could not end access" };
  revalidatePath(`/admin/${ctx.event.handle}/members`);
  return { ok: true, message: `${member.roster_name} no longer has access` };
}

export async function restoreMemberAction(eventId: string, membershipId: string): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("memberships")
    .select("id, user_id")
    .eq("event_id", eventId)
    .eq("id", membershipId)
    .maybeSingle();
  if (!member) return { error: "Member not found" };
  await supabase
    .from("memberships")
    .update({ status: member.user_id ? "active" : "pending", grace_started_at: null, grace_ends_at: null, grace_notices_sent: 0 })
    .eq("id", member.id);
  revalidatePath(`/admin/${ctx.event.handle}/members`);
  return { ok: true, message: "Access restored" };
}

// ---------------------------------------------------------------------------
// Albums and media
// ---------------------------------------------------------------------------

const albumSchema = z.object({
  title: z.string().trim().min(1, "Give the album a name").max(160),
  albumDate: z.union([z.literal(""), z.iso.date()]),
  description: z.string().trim().max(2000),
  allowDownload: z.boolean(),
  visibility: z.enum(["members", "admins"]),
  contributorScope: z.enum(["managers", "members"]),
  eventType: z.union([z.literal(""), z.enum(["formal", "sport", "social", "camp", "night_out", "other"])]),
});

function albumInput(form: FormData) {
  return albumSchema.safeParse({
    title: text(form, "title"),
    albumDate: text(form, "albumDate"),
    description: text(form, "description"),
    allowDownload: form.get("allowDownload") === "on",
    visibility: text(form, "visibility") || "members",
    contributorScope: text(form, "contributorScope") || "managers",
    eventType: text(form, "eventType"),
  });
}

export async function createAlbumAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_albums");
  if (!canWrite(ctx.event.billing_status)) return { error: ACTIVATE_MESSAGE };
  const parsed = albumInput(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .insert({
      event_id: eventId,
      title: parsed.data.title,
      album_date: parsed.data.albumDate || null,
      event_type: parsed.data.eventType || null,
      description: parsed.data.description || null,
      allow_download: parsed.data.allowDownload,
      status: "draft",
      visibility: parsed.data.visibility,
      contributor_scope: parsed.data.contributorScope,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the album" };

  // A go-live time is part of making the album in the design, not a later
  // errand, so the same form can set it.
  const publishAt = text(form, "publishAt");
  if (publishAt) {
    const when = new Date(publishAt);
    if (!Number.isNaN(when.getTime()) && when.getTime() > Date.now()) {
      await supabase.from("albums").update({ publish_at: when.toISOString() }).eq("id", data.id);
    }
  }

  // Straight into the uploader: an album with nothing in it is a dead end.
  redirect(`/e/${ctx.event.handle}/a/${data.id}?add=1`);
}

export async function updateAlbumAction(albumId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  const parsed = albumInput(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { error } = await supabase
    .from("albums")
    .update({
      title: parsed.data.title,
      album_date: parsed.data.albumDate || null,
      event_type: parsed.data.eventType || null,
      description: parsed.data.description || null,
      allow_download: parsed.data.allowDownload,
      visibility: parsed.data.visibility,
      contributor_scope: parsed.data.contributorScope,
    })
    .eq("id", albumId);
  if (error) return { error: "Could not save the album" };
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Saved" };
}

export async function setAlbumPublishedAction(albumId: string, published: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, published_at").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");

  if (published) {
    const { count } = await supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("album_id", albumId)
      .eq("status", "ready");
    if (!count) return { error: "Add at least one photo or video before publishing" };
  }

  const { error } = await supabase
    .from("albums")
    .update({
      status: published ? "published" : "draft",
      published_at: published ? (album.published_at ?? new Date().toISOString()) : album.published_at,
    })
    .eq("id", albumId);
  if (error) return { error: "Could not update the album" };

  // Tell members who opted in, once, when the album first goes live.
  if (published && album.published_at === null) {
    after(async () => {
      try {
        await notifyNewAlbum(ctx.event.id, albumId, ctx.userId);
      } catch (notifyError) {
        console.error("album notification failed", notifyError);
      }
    });
  }

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return {
    ok: true,
    message: published ? "Album published. Members who opted in get an email." : "Album moved back to draft",
  };
}

export async function setAlbumCoverAction(albumId: string, mediaId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  const { error } = await supabase.from("albums").update({ cover_media_id: mediaId, cover_path: null }).eq("id", albumId);
  if (error) return { error: "Could not set the cover" };
  revalidatePath(`/admin/${ctx.event.handle}/albums/${albumId}`);
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Cover updated" };
}

export async function setAlbumCoverImageAction(albumId: string, path: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  if (path !== null && !path.startsWith(`events/${album.event_id}/covers/`)) return { error: "Invalid cover path" };

  const { data: before } = await supabase.from("albums").select("cover_path").eq("id", albumId).maybeSingle();
  const { error } = await supabase.from("albums").update({ cover_path: path, cover_media_id: null }).eq("id", albumId);
  if (error) return { error: "Could not save the cover" };
  // Covers are uploaded under a new name each time (so a cached URL can't
  // show the old one); clear the file this replaced.
  if (before?.cover_path && before.cover_path !== path) {
    await removeObjects([before.cover_path]).catch((removeError) =>
      console.error("could not remove old cover", before.cover_path, removeError),
    );
  }
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: path ? "Cover updated" : "Cover cleared" };
}

export async function deleteMediaAction(mediaIds: string[]): Promise<ActionState> {
  const ids = z.array(z.uuid()).min(1).max(500).safeParse(mediaIds);
  if (!ids.success) return { error: "Nothing selected" };
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("media")
    .select("id, event_id, album_id, storage_path, thumb_path, display_path, poster_path")
    .in("id", ids.data);
  const items = rows ?? [];
  if (items.length === 0) return { error: "Nothing to delete" };

  const eventIds = [...new Set(items.map((m) => m.event_id))];
  const contexts = await Promise.all(eventIds.map(adminContext));

  await removeObjects(items.flatMap((m) => [m.storage_path, m.thumb_path ?? "", m.display_path ?? "", m.poster_path ?? ""]));
  const { error } = await supabase.from("media").delete().in("id", items.map((m) => m.id));
  if (error) return { error: "Could not delete" };
  // Deleting the photos cascaded their media_faces rows, whose trigger queued
  // each faceprint. Draining now keeps "the faceprint goes with the photo"
  // true immediately rather than by the next cron pass.
  await drainFacePurgeQueue().catch((purgeError) => console.error("face purge after delete", purgeError));

  for (const ctx of contexts) {
    revalidatePath(`/admin/${ctx.event.handle}`, "layout");
    revalidatePath(`/e/${ctx.event.handle}`, "layout");
  }
  return { ok: true, message: `${items.length} deleted` };
}

export async function deleteAlbumAction(albumId: string, typedTitle: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, title").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  if (typedTitle.trim().toLowerCase() !== album.title.trim().toLowerCase()) {
    return { error: `Type ${album.title} to confirm` };
  }

  for (;;) {
    const { data: batch } = await supabase
      .from("media")
      .select("id, storage_path, thumb_path, display_path, poster_path")
      .eq("album_id", albumId)
      .limit(500);
    if (!batch || batch.length === 0) break;
    await removeObjects(batch.flatMap((m) => [m.storage_path, m.thumb_path ?? "", m.display_path ?? "", m.poster_path ?? ""]));
    await supabase.from("media").delete().in("id", batch.map((m) => m.id));
  }
  await supabase.from("albums").delete().eq("id", albumId);
  await drainFacePurgeQueue().catch((purgeError) => console.error("face purge after album delete", purgeError));

  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  redirect(`/admin/${ctx.event.handle}/albums`);
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name").max(40),
  manage_event: z.boolean(),
  manage_members: z.boolean(),
  manage_albums: z.boolean(),
  upload: z.boolean(),
  post_feed: z.boolean(),
  is_default: z.boolean(),
});

function roleInput(form: FormData) {
  return roleSchema.safeParse({
    name: text(form, "name"),
    manage_event: form.get("manage_event") === "on",
    manage_members: form.get("manage_members") === "on",
    manage_albums: form.get("manage_albums") === "on",
    upload: form.get("upload") === "on",
    post_feed: form.get("post_feed") === "on",
    is_default: form.get("is_default") === "on",
  });
}

function roleKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "role";
}

export async function createRoleAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_event");
  const parsed = roleInput(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  if (parsed.data.is_default) await supabase.from("event_roles").update({ is_default: false }).eq("event_id", eventId);
  const { error } = await supabase.from("event_roles").insert({
    event_id: eventId,
    key: `${roleKey(parsed.data.name)}_${Math.random().toString(36).slice(2, 6)}`,
    name: parsed.data.name,
    manage_event: parsed.data.manage_event,
    manage_members: parsed.data.manage_members,
    manage_albums: parsed.data.manage_albums,
    upload: parsed.data.upload,
    post_feed: parsed.data.post_feed,
    is_default: parsed.data.is_default,
    sort_order: 10,
  });
  if (error) return { error: "Could not create that role" };
  revalidatePath(`/admin/${ctx.event.handle}/roles`);
  revalidatePath(`/admin/${ctx.event.handle}/members`);
  return { ok: true, message: `${parsed.data.name} added` };
}

export async function updateRoleAction(eventId: string, roleId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_event");
  const parsed = roleInput(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  if (parsed.data.is_default) await supabase.from("event_roles").update({ is_default: false }).eq("event_id", eventId);
  const { error } = await supabase
    .from("event_roles")
    .update({
      name: parsed.data.name,
      manage_event: parsed.data.manage_event,
      manage_members: parsed.data.manage_members,
      manage_albums: parsed.data.manage_albums,
      upload: parsed.data.upload,
      post_feed: parsed.data.post_feed,
      is_default: parsed.data.is_default,
    })
    .eq("id", roleId)
    .eq("event_id", eventId);
  if (error) return { error: "Could not save that role" };
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Role saved" };
}

export async function deleteRoleAction(eventId: string, roleId: string): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_event");
  const supabase = await createClient();
  const { data: role } = await supabase.from("event_roles").select("id, is_builtin, name").eq("id", roleId).eq("event_id", eventId).maybeSingle();
  if (!role) return { error: "Role not found" };
  if (role.is_builtin) return { error: "Built-in roles can't be deleted" };

  const { data: fallback } = await supabase
    .from("event_roles")
    .select("id")
    .eq("event_id", eventId)
    .eq("key", "member")
    .maybeSingle();
  await supabase.from("memberships").update({ role_id: fallback?.id ?? null }).eq("event_id", eventId).eq("role_id", roleId);
  const { error } = await supabase.from("event_roles").delete().eq("id", roleId);
  if (error) return { error: "Could not delete that role" };
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return { ok: true, message: `${role.name} deleted` };
}

export async function setMemberRoleAction(eventId: string, membershipIds: string[], roleId: string): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_members");
  const ids = z.array(z.uuid()).min(1).max(500).safeParse(membershipIds);
  if (!ids.success || !z.uuid().safeParse(roleId).success) return { error: "Select members and a role" };

  const supabase = await createClient();
  const { data: role } = await supabase.from("event_roles").select("id, name, manage_event").eq("id", roleId).eq("event_id", eventId).maybeSingle();
  if (!role) return { error: "Role not found" };
  if (role.manage_event && !ctx.perms.manage_event) return { error: "Only an admin can hand out admin roles" };

  // Moving people off an admin role can orphan the event: nobody left who can
  // add members, publish, or reach billing. The removal path already checks
  // this; a role change has to as well.
  if (!role.manage_event) {
    const { data: targets } = await supabase
      .from("memberships")
      .select("id")
      .eq("event_id", eventId)
      .eq("role", "event_admin")
      .eq("status", "active")
      .in("id", ids.data);
    const losing = targets?.length ?? 0;
    if (losing > 0) {
      const { count } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("role", "event_admin")
        .eq("status", "active");
      if ((count ?? 0) - losing < 1) return { error: "A event needs at least one admin" };
    }
  }

  const { error } = await supabase.from("memberships").update({ role_id: roleId }).eq("event_id", eventId).in("id", ids.data);
  if (error) return { error: "Could not change the role" };
  revalidatePath(`/admin/${ctx.event.handle}/members`);
  return { ok: true, message: `${ids.data.length} moved to ${role.name}` };
}

/** Hides an album from members, or puts it back. No files are touched. */
export async function setAlbumHiddenAction(albumId: string, hidden: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, status, published_at").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");

  // Unhiding returns it to whatever it was: published if it ever went live,
  // otherwise back to draft.
  const next = hidden ? "hidden" : album.published_at ? "published" : "draft";
  const { error } = await supabase.from("albums").update({ status: next }).eq("id", albumId);
  if (error) return { error: "Could not update the album" };

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: hidden ? "Hidden from members" : "Back in the event" };
}

/**
 * Queues a draft to publish itself. The hourly cron does the publishing, so a
 * time in the past goes live on the next pass rather than immediately.
 */
export async function scheduleAlbumAction(albumId: string, publishAt: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, status").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  if (album.status !== "draft") return { error: "Only a draft can be scheduled" };

  let when: string | null = null;
  if (publishAt) {
    const parsed = new Date(publishAt);
    if (Number.isNaN(parsed.getTime())) return { error: "That date didn't make sense" };
    when = parsed.toISOString();
  }

  const { error } = await supabase.from("albums").update({ publish_at: when }).eq("id", albumId);
  if (error) return { error: "Could not set the schedule" };

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return {
    ok: true,
    message: when ? "Scheduled. It goes live on the hour after that time." : "Schedule cleared",
  };
}

/**
 * Writes an explicit order for a event's albums. The caller sends the full list
 * in the order it wants, so a move is idempotent and can't interleave with
 * another committee member's.
 */
export async function setAlbumOrderAction(eventId: string, orderedIds: string[]): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_albums");
  const ids = z.array(z.uuid()).min(1).max(200).safeParse(orderedIds);
  if (!ids.success) return { error: "Nothing to reorder" };

  const supabase = await createClient();
  const { data: owned } = await supabase.from("albums").select("id").eq("event_id", eventId).in("id", ids.data);
  const ownedIds = new Set((owned ?? []).map((a) => a.id));
  if (ownedIds.size !== ids.data.length) return { error: "Those albums aren't all in this event" };

  // Descending, so first in the list sorts highest and new albums (0) fall to
  // the bottom of the explicit ones.
  const total = ids.data.length;
  const results = await Promise.all(
    ids.data.map((id, index) => supabase.from("albums").update({ sort_order: total - index }).eq("id", id)),
  );
  if (results.some((r) => r.error)) return { error: "Could not save the new order" };

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Order saved" };
}

/**
 * Hands the event to another member: they get an admin role, and the event's
 * created_by follows so the record of who runs it stays true. The outgoing
 * owner keeps their own role — stepping down is a separate, deliberate act.
 */
export async function transferOwnershipAction(eventId: string, membershipId: string): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_event");
  if (!z.uuid().safeParse(membershipId).success) return { error: "Pick who takes over" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("memberships")
    .select("id, user_id, roster_name, claimed_name, status")
    .eq("id", membershipId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!target) return { error: "That member isn't in this event" };
  if (target.status !== "active") return { error: "They need to have signed in first" };
  if (!target.user_id) return { error: "They need to have signed in first" };

  const { data: adminRole } = await supabase
    .from("event_roles")
    .select("id")
    .eq("event_id", eventId)
    .eq("manage_event", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!adminRole) return { error: "This event has no admin role to hand over" };

  const { error: roleError } = await supabase
    .from("memberships")
    .update({ role_id: adminRole.id })
    .eq("id", membershipId);
  if (roleError) return { error: "Could not give them the admin role" };

  const { error: eventError } = await supabase.from("events").update({ created_by: target.user_id }).eq("id", eventId);
  if (eventError) return { error: "Handed over the role, but could not update the event record" };

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  return { ok: true, message: `${target.claimed_name ?? target.roster_name} now runs ${ctx.event.name}` };
}

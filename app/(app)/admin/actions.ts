"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { isHeardFrom, SOURCE_COOKIE, SOURCE_TAG } from "@/lib/attribution";
import { getEventContextById, requireUser } from "@/lib/auth/session";
import { mediaUnits } from "@/lib/billing/plans";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import { kickPlanNotices } from "@/lib/billing/notices";
import { getPlanUsage } from "@/lib/billing/usage";
import type { Permission } from "@/lib/permissions";
import { deleteEventEverywhere } from "@/lib/events/delete";
import { canRestoreEvent, purgeAlbum, purgeMedia } from "@/lib/media/bin";
import { drainFacePurgeQueue } from "@/lib/faces/purge";
import { brisbaneInputToIso } from "@/lib/format";
import { notifyNewAlbum } from "@/lib/notify";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { generateHandleBase } from "@/lib/roster/handle";
import sharp from "sharp";
import { BUCKET, LOGO_MARK_SIZE, logoMarkPath, removeObjects } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean; message?: string; ids?: string[] };

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

const isoDate = z.union([z.literal(""), z.iso.date("Pick a date")]);

const eventSchema = z
  .object({
    name: z.string().trim().min(2, "Give the event a name").max(120),
    organisation: z.string().trim().max(160),
    description: z.string().trim().max(1000),
    startsOn: isoDate,
    endsOn: isoDate,
    venue: z.string().trim().max(160),
  })
  .refine((v) => !v.endsOn || !v.startsOn || v.endsOn >= v.startsOn, {
    message: "The last day can't be before the first",
    path: ["endsOn"],
  });

function eventInput(form: FormData) {
  return {
    name: text(form, "name"),
    organisation: text(form, "organisation"),
    description: text(form, "description"),
    startsOn: text(form, "startsOn"),
    endsOn: text(form, "endsOn"),
    venue: text(form, "venue"),
  };
}

export async function createEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireUser("/admin/new");
  const parsed = eventSchema.safeParse(eventInput(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const accessMode = text(form, "accessMode") === "guest_list" ? "guest_list" : "link";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_name: parsed.data.name,
    p_handle_base: generateHandleBase(parsed.data.name),
    p_organisation: parsed.data.organisation,
    p_description: parsed.data.description,
    p_starts_on: parsed.data.startsOn || undefined,
    p_ends_on: parsed.data.endsOn || undefined,
    p_venue: parsed.data.venue,
    p_access_mode: accessMode,
  });
  if (error || !data) return { error: "Could not create the event. Try again." };

  // Where this organiser came from (pricing handoff §5.9): the tracked link
  // they first arrived through, and their answer to "How did you hear about us?".
  const tag = (await cookies()).get(SOURCE_COOKIE)?.value ?? "";
  const heardFrom = text(form, "heardFrom");
  const origin = {
    source: SOURCE_TAG.test(tag) ? tag : null,
    heard_from: isHeardFrom(heardFrom) ? heardFrom : null,
  };
  if (origin.source || origin.heard_from) {
    await createAdminClient()
      .from("events")
      .update(origin)
      .eq("id", data.id)
      .then(({ error: originError }) => originError && console.error("could not save where the event came from", originError));
  }

  redirect(`/admin/${data.handle}/setup`);
}

const eventSettingsSchema = z.object({
  accentColour: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must look like #2b4acb")]),
});

export async function updateEventAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const parsed = eventSchema.safeParse(eventInput(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const colour = eventSettingsSchema.safeParse({ accentColour: text(form, "accentColour") });
  if (!colour.success) return { error: colour.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      organisation: parsed.data.organisation || null,
      description: parsed.data.description || null,
      starts_on: parsed.data.startsOn || null,
      ends_on: parsed.data.endsOn || null,
      venue: parsed.data.venue || null,
      accent_colour: colour.data.accentColour || null,
    })
    .eq("id", eventId);
  if (error) return { error: "Could not save the settings" };
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: "Saved" };
}

const accessSchema = z.object({
  accessMode: z.enum(["link", "guest_list"]),
  // A calendar day; the gallery closes at the end of it, Brisbane time.
  accessEndsOn: isoDate,
});

/** Who can get in, and until when. */
export async function setEventAccessAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const parsed = accessSchema.safeParse({ accessMode: text(form, "accessMode"), accessEndsOn: text(form, "accessEndsOn") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const endsAt = parsed.data.accessEndsOn ? endOfDayBrisbane(parsed.data.accessEndsOn) : null;
  const previous = ctx.event.access_ends_at;
  const unchanged = endsAt === null ? previous === null : previous !== null && Date.parse(previous) === Date.parse(endsAt);
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      access_mode: parsed.data.accessMode,
      access_ends_at: endsAt,
      ...(unchanged ? {} : { access_notice_sent_at: null }),
    })
    .eq("id", eventId);
  if (error) return { error: "Could not save access" };
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  // The database caps the closing date at the 12 month deletion (migration 31).
  const deleteAt = ctx.event.photos_delete_at;
  if (endsAt && deleteAt && Date.parse(endsAt) > Date.parse(deleteAt)) {
    return { ok: true, message: "Saved. The gallery closes when the photos are deleted, which is as late as it can stay open." };
  }
  return { ok: true, message: "Saved" };
}

/** 23:59:59 on that day in Brisbane (UTC+10, no daylight saving). */
function endOfDayBrisbane(day: string): string {
  return new Date(`${day}T23:59:59+10:00`).toISOString();
}

/** The event-wide privacy switch the settings screen shows. */
export async function setEventPrivacyAction(
  eventId: string,
  prefs: { allow_removal_requests: boolean },
): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_event");
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ allow_removal_requests: prefs.allow_removal_requests })
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
// Attendees and team
// ---------------------------------------------------------------------------

const memberSchema = z.object({
  name: z.string().trim().min(1, "Enter their full name").max(200),
  email: z.string().transform(normaliseEmail).refine(isValidEmail, "Enter a valid email address"),
  roleKey: z.enum(["member", "photographer", "admin"]),
});

export async function addMemberAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  if (!canWrite(ctx.event)) return { error: ACTIVATE_MESSAGE };
  const parsed = memberSchema.safeParse({
    name: text(form, "name"),
    email: text(form, "email"),
    roleKey: text(form, "roleKey") || "member",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const [{ data: existing }, { data: role }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, status, user_id")
      .eq("event_id", eventId)
      .eq("roster_email", parsed.data.email)
      .maybeSingle(),
    supabase.from("event_roles").select("id").eq("event_id", eventId).eq("key", parsed.data.roleKey).maybeSingle(),
  ]);

  if (existing && (existing.status === "active" || existing.status === "pending")) {
    return { error: `${parsed.data.email} is already on the list` };
  }

  const now = new Date().toISOString();
  const { error } = existing
    ? await supabase
        .from("memberships")
        .update({ status: existing.user_id ? "active" : "pending", invited_at: now, role_id: role?.id ?? null })
        .eq("id", existing.id)
    : await supabase.from("memberships").insert({
        event_id: eventId,
        roster_email: parsed.data.email,
        roster_name: parsed.data.name,
        status: "pending",
        role: "event_member",
        role_id: role?.id ?? null,
        invited_at: now,
      });
  if (error) return { error: "Could not add them" };

  revalidatePath(`/admin/${ctx.event.handle}/attendees`);
  return { ok: true, message: existing ? `${parsed.data.name} is back on the list` : `${parsed.data.name} added` };
}

/** Removal is immediate: an event has no members who leave and keep access. */
export async function removeMembersAction(eventId: string, membershipIds: string[]): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const ids = z.array(z.uuid()).min(1).max(1000).safeParse(membershipIds);
  if (!ids.success) return { error: "Select at least one person" };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("event_id", eventId)
    .in("id", ids.data)
    .in("status", ["pending", "active", "grace"]);
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
    if ((count ?? 0) - removingAdmins < 1) return { error: "An event needs at least one organiser" };
  }

  const { error } = await supabase
    .from("memberships")
    .update({ status: "revoked" })
    .in("id", targets.map((m) => m.id));
  if (error) return { error: "Could not remove them" };
  // Removing a guest can let a paused one in: email them.
  kickPlanNotices(eventId);

  revalidatePath(`/admin/${ctx.event.handle}/attendees`);
  return { ok: true, message: `${targets.length} removed. They can no longer open the event.` };
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
  if (!member) return { error: "Not found" };
  await supabase
    .from("memberships")
    .update({ status: member.user_id ? "active" : "pending", grace_started_at: null, grace_ends_at: null })
    .eq("id", member.id);
  revalidatePath(`/admin/${ctx.event.handle}/attendees`);
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
});

function albumInput(form: FormData) {
  return albumSchema.safeParse({
    title: text(form, "title"),
    albumDate: text(form, "albumDate"),
    description: text(form, "description"),
    allowDownload: form.get("allowDownload") === "on",
    visibility: text(form, "visibility") || "members",
    contributorScope: text(form, "contributorScope") || "managers",
  });
}

export async function createAlbumAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_albums");
  if (!canWrite(ctx.event)) return { error: ACTIVATE_MESSAGE };
  const parsed = albumInput(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // A go-live time is part of making the album in the design, not a later
  // errand, so the same form can set it. Checked first, so a bad time doesn't
  // leave a half-made album behind.
  const publishInput = text(form, "publishAt");
  const publishAt = publishInput ? brisbaneInputToIso(publishInput) : null;
  if (publishInput && !publishAt) return { error: "That go-live time didn't make sense" };
  if (publishAt && new Date(publishAt).getTime() <= Date.now()) {
    return { error: "That go-live time has already passed. Pick a later one, or publish straight away." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .insert({
      event_id: eventId,
      title: parsed.data.title,
      album_date: parsed.data.albumDate || null,
      description: parsed.data.description || null,
      allow_download: parsed.data.allowDownload,
      status: "draft",
      visibility: parsed.data.visibility,
      contributor_scope: parsed.data.contributorScope,
      created_by: ctx.userId,
      publish_at: publishAt,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the album" };

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

/**
 * "Publish all drafts" (the morning after): every draft with at least one
 * finished file goes live, through the same path as one at a time. Scheduled
 * drafts are left to their schedule.
 */
export async function publishAllDraftsAction(eventId: string): Promise<void> {
  const ctx = await permContext(eventId, "manage_albums");
  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from("albums")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "draft")
    .is("publish_at", null)
    .is("deleted_at", null);
  for (const album of drafts ?? []) {
    // Empty drafts refuse with a message; publishing the rest still goes on.
    await setAlbumPublishedAction(album.id, true);
  }
  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
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

  // Tell attendees who opted in, once, when the album first goes live.
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
    message: published ? "Album published. Attendees who opted in get an email." : "Album moved back to draft",
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

function itemsLabel(kinds: string[]): string {
  const n = kinds.length;
  if (kinds.every((k) => k === "video")) return n === 1 ? "1 video" : `${n} videos`;
  if (kinds.every((k) => k !== "video")) return n === 1 ? "1 photo" : `${n} photos`;
  return `${n} items`;
}

/**
 * Moves photos and videos to Recently deleted. Nothing leaves storage until
 * the bin's 30 days are up (lib/media/bin.ts); attendees stop seeing them at
 * once because RLS hides binned rows.
 */
export async function deleteMediaAction(mediaIds: string[]): Promise<ActionState> {
  const ids = z.array(z.uuid()).min(1).max(500).safeParse(mediaIds);
  if (!ids.success) return { error: "Nothing selected" };
  const supabase = await createClient();
  const { data: rows } = await supabase.from("media").select("id, event_id, kind").in("id", ids.data);
  const items = rows ?? [];
  if (items.length === 0) return { error: "Nothing to delete" };

  const eventIds = [...new Set(items.map((m) => m.event_id))];
  const contexts = await Promise.all(eventIds.map(adminContext));

  const { error } = await createAdminClient()
    .from("media")
    .update({ deleted_at: new Date().toISOString(), deleted_by: contexts[0].userId })
    .in("id", items.map((m) => m.id))
    .is("deleted_at", null);
  if (error) return { error: "Could not delete" };

  for (const ctx of contexts) {
    revalidatePath(`/admin/${ctx.event.handle}`, "layout");
    revalidatePath(`/e/${ctx.event.handle}`, "layout");
  }
  return { ok: true, message: `Deleted ${itemsLabel(items.map((m) => m.kind))}`, ids: items.map((m) => m.id) };
}

/**
 * Restoring doesn't go through the database's insert check, so it is checked
 * here: bringing these back mustn't take the event past its photo allowance.
 */
async function pastAllowance(
  eventId: string,
  items: { kind: string; status: string; duration_seconds: number | null }[],
): Promise<string | null> {
  const usage = await getPlanUsage(eventId);
  if (!usage?.photoLimit) return null;
  const adding = items.filter((m) => m.status !== "failed").reduce((sum, m) => sum + mediaUnits(m.kind, m.duration_seconds), 0);
  if (usage.unitsUsed + adding <= usage.photoLimit) return null;
  return `Restoring ${items.length === 1 ? "this" : "these"} would take the event past its limit of ${usage.photoLimit} photos. Delete something else first.`;
}

/** Brings binned photos back. Photos binned with their album come back with the album instead. */
export async function restoreMediaAction(mediaIds: string[]): Promise<ActionState> {
  const ids = z.array(z.uuid()).min(1).max(500).safeParse(mediaIds);
  if (!ids.success) return { error: "Nothing selected" };
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("media")
    .select("id, event_id, kind, status, duration_seconds, album_id, albums!media_album_id_fkey(deleted_at)")
    .in("id", ids.data)
    .not("deleted_at", "is", null);
  const items = rows ?? [];
  if (items.length === 0) return { error: "Nothing to restore" };

  const contexts = await Promise.all([...new Set(items.map((m) => m.event_id))].map(adminContext));
  const restorable = items.filter((m) => !m.albums?.deleted_at);
  if (restorable.length === 0) return { error: "Restore the album these were in first" };
  for (const ctx of contexts) {
    const over = await pastAllowance(ctx.event.id, restorable.filter((m) => m.event_id === ctx.event.id));
    if (over) return { error: over };
  }

  const { error } = await admin.from("media").update({ deleted_at: null, deleted_by: null }).in("id", restorable.map((m) => m.id));
  if (error) return { error: "Could not restore" };
  for (const ctx of contexts) {
    revalidatePath(`/admin/${ctx.event.handle}`, "layout");
    revalidatePath(`/e/${ctx.event.handle}`, "layout");
  }
  const skipped = items.length - restorable.length;
  return {
    ok: true,
    message: `Restored ${itemsLabel(restorable.map((m) => m.kind))}${skipped ? `. ${skipped} more come back with their album` : ""}`,
    ids: restorable.map((m) => m.id),
  };
}

/** "Delete now" in the bin: permanent, for photos already in it. */
export async function purgeMediaNowAction(eventId: string, mediaIds: string[]): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  const ids = z.array(z.uuid()).min(1).max(500).safeParse(mediaIds);
  if (!ids.success) return { error: "Nothing selected" };
  const { data: rows } = await createAdminClient()
    .from("media")
    .select("id")
    .eq("event_id", eventId)
    .in("id", ids.data)
    .not("deleted_at", "is", null);
  const purged = await purgeMedia((rows ?? []).map((m) => m.id));
  await drainFacePurgeQueue().catch((purgeError) => console.error("face purge after delete now", purgeError));
  revalidatePath(`/admin/${ctx.event.handle}/settings/deleted`);
  return { ok: true, message: purged === 1 ? "Deleted for good" : `${purged} deleted for good` };
}

export async function deleteAlbumAction(albumId: string, typedTitle: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, title").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  if (typedTitle.trim().toLowerCase() !== album.title.trim().toLowerCase()) {
    return { error: `Type ${album.title} to confirm` };
  }

  // The album and every photo still in it share one timestamp, which is how
  // restoring the album knows which photos came with it.
  const admin = createAdminClient();
  const stamp = { deleted_at: new Date().toISOString(), deleted_by: ctx.userId };
  const { error: mediaError } = await admin.from("media").update(stamp).eq("album_id", albumId).is("deleted_at", null);
  if (mediaError) return { error: "Could not delete the album" };
  const { error } = await admin.from("albums").update(stamp).eq("id", albumId);
  if (error) return { error: "Could not delete the album" };

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  redirect(`/admin/${ctx.event.handle}/albums?deleted=${albumId}`);
}

export async function restoreAlbumAction(albumId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(albumId).success) return { error: "Album not found" };
  const admin = createAdminClient();
  const { data: album } = await admin.from("albums").select("id, event_id, title, deleted_at").eq("id", albumId).maybeSingle();
  if (!album?.deleted_at) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  const { data: coming } = await admin
    .from("media")
    .select("kind, status, duration_seconds")
    .eq("album_id", albumId)
    .eq("deleted_at", album.deleted_at);
  const over = await pastAllowance(ctx.event.id, coming ?? []);
  if (over) return { error: over };

  const { error: mediaError } = await admin
    .from("media")
    .update({ deleted_at: null, deleted_by: null })
    .eq("album_id", albumId)
    .eq("deleted_at", album.deleted_at);
  if (mediaError) return { error: "Could not restore the album" };
  const { error } = await admin.from("albums").update({ deleted_at: null, deleted_by: null }).eq("id", albumId);
  if (error) return { error: "Could not restore the album" };

  revalidatePath(`/admin/${ctx.event.handle}`, "layout");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  return { ok: true, message: `Restored ${album.title}` };
}

export async function purgeAlbumNowAction(albumId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(albumId).success) return { error: "Album not found" };
  const { data: album } = await createAdminClient().from("albums").select("id, event_id, deleted_at").eq("id", albumId).maybeSingle();
  if (!album?.deleted_at) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  await purgeAlbum(albumId);
  await drainFacePurgeQueue().catch((purgeError) => console.error("face purge after album delete now", purgeError));
  revalidatePath(`/admin/${ctx.event.handle}/settings/deleted`);
  return { ok: true, message: "Album deleted for good" };
}

/**
 * Moves the whole event to the bin. Attendees lose it at once (RLS treats a
 * binned event as having no members); any organiser can restore it from Your
 * events for 30 days. Only someone who runs the event can, and only after
 * typing its name.
 */
export async function deleteEventAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await adminContext(eventId);
  if (text(form, "confirm").toLowerCase() !== ctx.event.name.trim().toLowerCase()) {
    return { error: `Type ${ctx.event.name} to confirm` };
  }
  const { error } = await createAdminClient()
    .from("events")
    .update({ deleted_at: new Date().toISOString(), deleted_by: ctx.userId })
    .eq("id", eventId);
  if (error) {
    console.error("event delete failed", eventId, error);
    return { error: "Something went wrong and the event is still here. Try again." };
  }
  revalidatePath("/events");
  revalidatePath(`/e/${ctx.event.handle}`, "layout");
  redirect(`/events?deleted=${eventId}`);
}

export async function restoreEventAction(eventId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(eventId).success || !(await canRestoreEvent(eventId, user.id))) return { error: "Event not found" };
  const { data: event, error } = await createAdminClient()
    .from("events")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", eventId)
    .not("deleted_at", "is", null)
    .select("name, handle")
    .maybeSingle();
  if (error || !event) return { error: "Could not restore the event" };
  revalidatePath("/events");
  revalidatePath(`/e/${event.handle}`, "layout");
  revalidatePath(`/admin/${event.handle}`, "layout");
  return { ok: true, message: `Restored ${event.name}` };
}

export async function purgeEventNowAction(eventId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(eventId).success || !(await canRestoreEvent(eventId, user.id))) return { error: "Event not found" };
  const { data: event } = await createAdminClient().from("events").select("deleted_at").eq("id", eventId).maybeSingle();
  if (!event?.deleted_at) return { error: "Event not found" };
  try {
    await deleteEventEverywhere(eventId);
  } catch (error) {
    console.error("event delete now failed", eventId, error);
    return { error: "Something went wrong. Try again." };
  }
  revalidatePath("/events");
  return { ok: true, message: "Event deleted for good" };
}

// ---------------------------------------------------------------------------
// Roles: Organiser, Photographer, Attendee
// ---------------------------------------------------------------------------

export async function setMemberRoleAction(eventId: string, membershipIds: string[], roleId: string): Promise<ActionState> {
  const ctx = await permContext(eventId, "manage_members");
  const ids = z.array(z.uuid()).min(1).max(500).safeParse(membershipIds);
  if (!ids.success || !z.uuid().safeParse(roleId).success) return { error: "Select people and a role" };

  const supabase = await createClient();
  const { data: role } = await supabase.from("event_roles").select("id, name, manage_event").eq("id", roleId).eq("event_id", eventId).maybeSingle();
  if (!role) return { error: "Role not found" };
  if (role.manage_event && !ctx.perms.manage_event) return { error: "Only an organiser can make someone an organiser" };

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
      if ((count ?? 0) - losing < 1) return { error: "An event needs at least one organiser" };
    }
  }

  const { error } = await supabase.from("memberships").update({ role_id: roleId }).eq("event_id", eventId).in("id", ids.data);
  if (error) return { error: "Could not change the role" };
  revalidatePath(`/admin/${ctx.event.handle}/attendees`);
  return { ok: true, message: `${ids.data.length} now ${role.name}` };
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
  return { ok: true, message: hidden ? "Hidden from attendees" : "Back in the event" };
}

/**
 * Queues a draft to publish itself. `publishAt` is a `datetime-local` value,
 * read as Brisbane time. The hourly cron does the publishing.
 */
export async function scheduleAlbumAction(albumId: string, publishAt: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, event_id, status").eq("id", albumId).maybeSingle();
  if (!album) return { error: "Album not found" };
  const ctx = await permContext(album.event_id, "manage_albums");
  if (album.status !== "draft") return { error: "Only a draft can be scheduled" };

  let when: string | null = null;
  if (publishAt) {
    when = brisbaneInputToIso(publishAt);
    if (!when) return { error: "That date didn't make sense" };
    if (new Date(when).getTime() <= Date.now()) return { error: "That time has already passed. Pick a later one." };
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
 * another organiser's.
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

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { EventRecord, EventRole, Membership } from "@/lib/db/types";
import { facesConfigured } from "@/lib/faces/client";
import { NO_PERMS, permsFromRole, type Perms } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export async function requireUser(next?: string) {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/signin?next=${encodeURIComponent(next)}` : "/signin");
  return user;
}

export const getProfile = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  return data;
});

export type EventContext = {
  event: EventRecord;
  membership: Membership | null;
  role: EventRole | null;
  perms: Perms;
  isAdmin: boolean;
  userId: string;
  /** The access window has passed and this person isn't on the organising
      side. RLS already hides every photo; this lets pages say why. */
  accessClosed: boolean;
  /** Joined in the overflow window, which closed without an upgrade
      (migration 27). RLS already hides every photo; this lets pages say why. */
  paused: boolean;
};

export function accessHasEnded(event: Pick<EventRecord, "access_ends_at">, now = new Date()): boolean {
  return event.access_ends_at !== null && new Date(event.access_ends_at) <= now;
}

function membershipIsLive(m: Pick<Membership, "status" | "grace_ends_at">): boolean {
  if (m.status === "active") return true;
  return m.status === "grace" && m.grace_ends_at !== null && new Date(m.grace_ends_at) > new Date();
}

export const getEventContext = cache(async (handle: string): Promise<EventContext | null> => {
  const user = await requireUser(`/e/${handle}`);
  const supabase = await createClient();
  const normalised = handle.toLowerCase();

  const { data: event } = await supabase.from("events").select("*").eq("handle", normalised).maybeSingle();
  if (!event) {
    const { data: redirectRow } = await createAdminClient()
      .from("event_handle_redirects")
      .select("events(handle)")
      .eq("old_handle", normalised)
      .maybeSingle();
    if (redirectRow?.events?.handle) redirect(`/e/${redirectRow.events.handle}`);
    return null;
  }

  return resolveContext(event, user.id);
});

async function resolveContext(event: EventRecord, userId: string): Promise<EventContext | null> {
  const supabase = await createClient();
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("*, event_roles(*)").eq("event_id", event.id).eq("user_id", userId).maybeSingle(),
    supabase.from("users").select("is_super_admin").eq("id", userId).maybeSingle(),
  ]);

  const live = membership && membershipIsLive(membership) ? membership : null;
  const role = (membership?.event_roles as unknown as EventRole | null) ?? null;
  const superAdmin = Boolean(profile?.is_super_admin);
  const perms = superAdmin ? permsFromRole({ ...role, manage_event: true } as EventRole) : live ? permsFromRole(role) : { ...NO_PERMS };

  if (!live && !superAdmin) return null;

  return {
    event,
    membership: live,
    role,
    perms,
    isAdmin: perms.manage_event,
    userId,
    accessClosed: !perms.manage_albums && accessHasEnded(event),
    paused: !perms.manage_albums && Boolean(live?.paused_at),
  };
}

/** For route handlers: never redirects, returns null when unauthorised. */
export async function getEventContextById(eventId: string): Promise<EventContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return null;
  return resolveContext(event, user.id);
}

export type MyEvent = {
  membershipId: string;
  eventId: string;
  handle: string;
  name: string;
  organisation: string | null;
  logoPath: string | null;
  accentColour: string | null;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  accessEndsAt: string | null;
  roleName: string;
  isAdmin: boolean;
  since: string;
  /** This event analyses faces in its photos, so joining it means yours too. */
  facesEnabled: boolean;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function eventInitials(name: string): string {
  return initialsOf(name);
}

/** Every event this person can open, newest event first. */
export const listMyEvents = cache(async (): Promise<MyEvent[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select(
      "id, role, status, grace_ends_at, created_at, invited_at, event_roles(name, manage_event), events!inner(id, name, handle, organisation, status, logo_path, accent_colour, starts_on, ends_on, venue, access_ends_at, created_at, event_face_settings(enabled))",
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  return (data ?? [])
    .filter((m) => m.events.status === "active" && membershipIsLive(m))
    .map((m) => ({
      membershipId: m.id,
      eventId: m.events.id,
      handle: m.events.handle,
      name: m.events.name,
      organisation: m.events.organisation,
      logoPath: m.events.logo_path,
      accentColour: m.events.accent_colour,
      startsOn: m.events.starts_on,
      endsOn: m.events.ends_on,
      venue: m.events.venue,
      accessEndsAt: m.events.access_ends_at,
      roleName: m.event_roles?.name ?? (m.role === "event_admin" ? "Organiser" : "Attendee"),
      isAdmin: Boolean(m.event_roles?.manage_event) || m.role === "event_admin",
      since: m.invited_at ?? m.created_at,
      facesEnabled:
        facesConfigured() &&
        Boolean(
          (Array.isArray(m.events.event_face_settings) ? m.events.event_face_settings[0] : m.events.event_face_settings)
            ?.enabled,
        ),
      sortKey: m.events.starts_on ?? m.events.created_at,
    }))
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .map(({ sortKey, ...event }) => (void sortKey, event));
});

export type PublicEvent = {
  id: string;
  name: string;
  handle: string;
  organisation: string | null;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  logoPath: string | null;
  accentColour: string | null;
  accessMode: "link" | "guest_list";
};

/**
 * What anyone holding the event link may know: name, host, dates, venue and
 * logo. Never counts, covers or photos.
 */
export const getPublicEvent = cache(async (handle: string): Promise<PublicEvent | null> => {
  if (!/^[a-z0-9_]{1,48}$/i.test(handle)) return null;
  const { data } = await createAdminClient()
    .from("events")
    .select("id, name, handle, organisation, starts_on, ends_on, venue, logo_path, accent_colour, access_mode")
    .eq("handle", handle.toLowerCase())
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    handle: data.handle,
    organisation: data.organisation,
    startsOn: data.starts_on,
    endsOn: data.ends_on,
    venue: data.venue,
    logoPath: data.logo_path,
    accentColour: data.accent_colour,
    accessMode: data.access_mode === "guest_list" ? "guest_list" : "link",
  };
});

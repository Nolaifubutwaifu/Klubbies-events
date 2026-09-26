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
};

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

  return { event, membership: live, role, perms, isAdmin: perms.manage_event, userId };
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
  roleName: string;
  isAdmin: boolean;
  since: string;
  status: string;
  graceEndsAt: string | null;
  accepted: boolean;
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

/** Events the member has accepted, plus invitations still waiting. */
export const listMyEvents = cache(async (): Promise<{ events: MyEvent[]; invites: MyEvent[] }> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select(
      "id, role, status, grace_ends_at, created_at, invited_at, accepted_at, declined_at, event_roles(name, manage_event), events!inner(id, name, handle, organisation, status, logo_path, accent_colour, event_face_settings(enabled))",
    )
    .eq("user_id", user.id)
    .in("status", ["active", "grace"])
    .order("created_at", { ascending: true });

  const rows = (data ?? [])
    .filter((m) => m.events.status === "active" && membershipIsLive(m))
    .map((m) => ({
      membershipId: m.id,
      eventId: m.events.id,
      handle: m.events.handle,
      name: m.events.name,
      organisation: m.events.organisation,
      logoPath: m.events.logo_path,
      accentColour: m.events.accent_colour,
      roleName: m.event_roles?.name ?? (m.role === "event_admin" ? "Admin" : "Member"),
      isAdmin: Boolean(m.event_roles?.manage_event) || m.role === "event_admin",
      since: m.invited_at ?? m.created_at,
      status: m.status,
      graceEndsAt: m.grace_ends_at,
      accepted: m.accepted_at !== null,
      facesEnabled:
        facesConfigured() &&
        Boolean(
          (Array.isArray(m.events.event_face_settings) ? m.events.event_face_settings[0] : m.events.event_face_settings)
            ?.enabled,
        ),
    }));

  return {
    events: rows.filter((m) => m.accepted),
    invites: rows.filter((m) => !m.accepted),
  };
});

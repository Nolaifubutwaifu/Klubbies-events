import type { EventRole } from "@/lib/db/types";

export const PERMISSIONS = ["manage_event", "manage_members", "manage_albums", "upload"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Perms = Record<Permission, boolean>;

/** The three fixed roles every event gets (supabase/migrations/…_events.sql). */
export const ROLE_KEYS = ["admin", "photographer", "member"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, { label: string; hint: string }> = {
  admin: { label: "Organiser", hint: "Everything: settings, attendees, albums, billing and activity." },
  photographer: { label: "Photographer", hint: "Uploads into albums. Sees what attendees see." },
  member: { label: "Attendee", hint: "Views and downloads photos, finds their own." },
};

export const NO_PERMS: Perms = {
  manage_event: false,
  manage_members: false,
  manage_albums: false,
  upload: false,
};

export const ALL_PERMS: Perms = {
  manage_event: true,
  manage_members: true,
  manage_albums: true,
  upload: true,
};

/** Running the event implies every other permission. */
export function permsFromRole(role: Pick<EventRole, Permission> | null | undefined): Perms {
  if (!role) return { ...NO_PERMS };
  if (role.manage_event) return { ...ALL_PERMS };
  return {
    manage_event: false,
    manage_members: role.manage_members,
    manage_albums: role.manage_albums,
    upload: role.upload || role.manage_albums,
  };
}

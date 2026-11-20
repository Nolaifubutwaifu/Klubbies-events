import type { EventRole } from "@/lib/db/types";

export const PERMISSIONS = ["manage_event", "manage_members", "manage_albums", "upload"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Perms = Record<Permission, boolean>;

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

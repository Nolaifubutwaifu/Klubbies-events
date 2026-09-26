import type { EventRole } from "@/lib/db/types";

export const PERMISSIONS = ["manage_event", "manage_members", "manage_albums", "upload", "post_feed"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Perms = Record<Permission, boolean>;

export const PERMISSION_LABELS: Record<Permission, { label: string; hint: string }> = {
  manage_event: { label: "Run the event", hint: "Settings, billing, roles and the activity log. Includes everything below." },
  manage_members: { label: "Manage members", hint: "Add and remove people, import lists, change roles." },
  manage_albums: { label: "Manage albums", hint: "Create, edit, publish and delete albums." },
  upload: { label: "Add photos", hint: "Upload into albums that allow it." },
  post_feed: { label: "Post to the feed", hint: "Write event notices everyone sees." },
};

export const NO_PERMS: Perms = {
  manage_event: false,
  manage_members: false,
  manage_albums: false,
  upload: false,
  post_feed: false,
};

export const ALL_PERMS: Perms = {
  manage_event: true,
  manage_members: true,
  manage_albums: true,
  upload: true,
  post_feed: true,
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
    post_feed: role.post_feed,
  };
}

export function roleSummary(role: Pick<EventRole, Permission | "name">): string {
  if (role.manage_event) return "Everything";
  const parts = PERMISSIONS.filter((p) => p !== "manage_event" && role[p]).map((p) => PERMISSION_LABELS[p].label);
  return parts.length ? parts.join(" · ") : "View and download only";
}

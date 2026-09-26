import type { ClubRole } from "@/lib/db/types";

export const PERMISSIONS = ["manage_club", "manage_members", "manage_albums", "upload", "post_feed"] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Perms = Record<Permission, boolean>;

export const PERMISSION_LABELS: Record<Permission, { label: string; hint: string }> = {
  manage_club: { label: "Run the club", hint: "Settings, billing, roles and the activity log. Includes everything below." },
  manage_members: { label: "Manage members", hint: "Add and remove people, import lists, change roles." },
  manage_albums: { label: "Manage albums", hint: "Create, edit, publish and delete albums." },
  upload: { label: "Add photos", hint: "Upload into albums that allow it." },
  post_feed: { label: "Post to the feed", hint: "Write club notices everyone sees." },
};

export const NO_PERMS: Perms = {
  manage_club: false,
  manage_members: false,
  manage_albums: false,
  upload: false,
  post_feed: false,
};

export const ALL_PERMS: Perms = {
  manage_club: true,
  manage_members: true,
  manage_albums: true,
  upload: true,
  post_feed: true,
};

/** Running the club implies every other permission. */
export function permsFromRole(role: Pick<ClubRole, Permission> | null | undefined): Perms {
  if (!role) return { ...NO_PERMS };
  if (role.manage_club) return { ...ALL_PERMS };
  return {
    manage_club: false,
    manage_members: role.manage_members,
    manage_albums: role.manage_albums,
    upload: role.upload || role.manage_albums,
    post_feed: role.post_feed,
  };
}

export function roleSummary(role: Pick<ClubRole, Permission | "name">): string {
  if (role.manage_club) return "Everything";
  const parts = PERMISSIONS.filter((p) => p !== "manage_club" && role[p]).map((p) => PERMISSION_LABELS[p].label);
  return parts.length ? parts.join(" · ") : "View and download only";
}

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Club, ClubRole, Membership } from "@/lib/db/types";
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

export type ClubContext = {
  club: Club;
  membership: Membership | null;
  role: ClubRole | null;
  perms: Perms;
  isAdmin: boolean;
  userId: string;
};

function membershipIsLive(m: Pick<Membership, "status" | "grace_ends_at">): boolean {
  if (m.status === "active") return true;
  return m.status === "grace" && m.grace_ends_at !== null && new Date(m.grace_ends_at) > new Date();
}

export const getClubContext = cache(async (handle: string): Promise<ClubContext | null> => {
  const user = await requireUser(`/c/${handle}`);
  const supabase = await createClient();
  const normalised = handle.toLowerCase();

  const { data: club } = await supabase.from("clubs").select("*").eq("handle", normalised).maybeSingle();
  if (!club) {
    const { data: redirectRow } = await createAdminClient()
      .from("club_handle_redirects")
      .select("clubs(handle)")
      .eq("old_handle", normalised)
      .maybeSingle();
    if (redirectRow?.clubs?.handle) redirect(`/c/${redirectRow.clubs.handle}`);
    return null;
  }

  return resolveContext(club, user.id);
});

async function resolveContext(club: Club, userId: string): Promise<ClubContext | null> {
  const supabase = await createClient();
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("*, club_roles(*)").eq("club_id", club.id).eq("user_id", userId).maybeSingle(),
    supabase.from("users").select("is_super_admin").eq("id", userId).maybeSingle(),
  ]);

  const live = membership && membershipIsLive(membership) ? membership : null;
  const role = (membership?.club_roles as ClubRole | null) ?? null;
  const superAdmin = Boolean(profile?.is_super_admin);
  const perms = superAdmin ? permsFromRole({ ...role, manage_club: true } as ClubRole) : live ? permsFromRole(role) : { ...NO_PERMS };

  if (!live && !superAdmin) return null;

  return { club, membership: live, role, perms, isAdmin: perms.manage_club, userId };
}

/** For route handlers: never redirects, returns null when unauthorised. */
export async function getClubContextById(clubId: string): Promise<ClubContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: club } = await supabase.from("clubs").select("*").eq("id", clubId).maybeSingle();
  if (!club) return null;
  return resolveContext(club, user.id);
}

export type MyClub = {
  membershipId: string;
  clubId: string;
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
  /** This club analyses faces in its photos, so joining it means yours too. */
  facesEnabled: boolean;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function clubInitials(name: string): string {
  return initialsOf(name);
}

/** Clubs the member has accepted, plus invitations still waiting. */
export const listMyClubs = cache(async (): Promise<{ clubs: MyClub[]; invites: MyClub[] }> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select(
      "id, role, status, grace_ends_at, created_at, invited_at, accepted_at, declined_at, club_roles(name, manage_club), clubs!inner(id, name, handle, organisation, status, logo_path, accent_colour, club_face_settings(enabled))",
    )
    .eq("user_id", user.id)
    .in("status", ["active", "grace"])
    .order("created_at", { ascending: true });

  const rows = (data ?? [])
    .filter((m) => m.clubs.status === "active" && membershipIsLive(m))
    .map((m) => ({
      membershipId: m.id,
      clubId: m.clubs.id,
      handle: m.clubs.handle,
      name: m.clubs.name,
      organisation: m.clubs.organisation,
      logoPath: m.clubs.logo_path,
      accentColour: m.clubs.accent_colour,
      roleName: m.club_roles?.name ?? (m.role === "club_admin" ? "Admin" : "Member"),
      isAdmin: Boolean(m.club_roles?.manage_club) || m.role === "club_admin",
      since: m.invited_at ?? m.created_at,
      status: m.status,
      graceEndsAt: m.grace_ends_at,
      accepted: m.accepted_at !== null,
      facesEnabled:
        facesConfigured() &&
        Boolean(
          (Array.isArray(m.clubs.club_face_settings) ? m.clubs.club_face_settings[0] : m.clubs.club_face_settings)
            ?.enabled,
        ),
    }));

  return {
    clubs: rows.filter((m) => m.accepted),
    invites: rows.filter((m) => !m.accepted),
  };
});

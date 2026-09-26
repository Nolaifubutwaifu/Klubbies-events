import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { listStackedAlbums } from "@/lib/media/album-list";
import { createClient } from "@/lib/supabase/server";
import { Handover, type HandoverCandidate } from "./Handover";
import { PastSeasons, type Season } from "./PastSeasons";
import { RoleEditor } from "./RoleEditor";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Handover" };

export default async function RolesPage(props: PageProps<"/admin/[handle]/roles">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const [{ data: roles }, { data: counts }, { data: people }] = await Promise.all([
    supabase.from("club_roles").select("*").eq("club_id", ctx.club.id).order("sort_order").order("created_at"),
    supabase.from("memberships").select("role_id, status").eq("club_id", ctx.club.id).neq("status", "revoked"),
    // Only people who have actually signed in can be handed a club.
    supabase
      .from("memberships")
      .select("id, roster_name, claimed_name, role, user_id, status, users!memberships_user_id_fkey(display_name)")
      .eq("club_id", ctx.club.id)
      .eq("status", "active")
      .not("user_id", "is", null)
      .order("roster_name"),
  ]);

  const memberCount = new Map<string, number>();
  for (const row of counts ?? []) {
    if (!row.role_id) continue;
    memberCount.set(row.role_id, (memberCount.get(row.role_id) ?? 0) + 1);
  }

  const candidates: HandoverCandidate[] = (people ?? [])
    .filter((m) => m.user_id !== ctx.userId)
    .map((m) => ({
      membershipId: m.id,
      name: personName({ displayName: m.users?.display_name, claimedName: m.claimed_name, rosterName: m.roster_name }),
      isAdmin: m.role === "club_admin",
    }));
  const owner = (people ?? []).find((m) => m.user_id === ctx.userId);

  // Seasons come out of the albums themselves: the club's history is whatever
  // it has published, grouped by the year it happened in.
  const albums = await listStackedAlbums(supabase, ctx.club.id, { includeDrafts: true, limit: 200 });
  const thisYear = new Date().getFullYear();
  const byYear = new Map<number, Season>();
  for (const album of albums) {
    const year = new Date(album.date).getFullYear();
    if (!Number.isFinite(year) || year >= thisYear) continue;
    const season = byYear.get(year) ?? { year, albums: 0, photos: 0, people: [], tiles: [] };
    season.albums += 1;
    season.photos += album.photoCount + album.videoCount;
    for (const tile of album.tiles) if (tile.url && season.tiles.length < 3) season.tiles.push(tile.url);
    byYear.set(year, season);
  }
  const seasons = [...byYear.values()].sort((a, b) => b.year - a.year).slice(0, 6);

  return (
    <main className="flex flex-col gap-7 px-4 py-8 sm:px-6">
      <PageTitle kicker={ctx.club.name} title="Handover">
        Your club&rsquo;s history doesn&rsquo;t graduate with your media officer. Move ownership, change roles, keep
        every past season.
      </PageTitle>
      <RoleEditor
        clubId={ctx.club.id}
        roles={(roles ?? []).map((role) => ({ ...role, memberCount: memberCount.get(role.id) ?? 0 }))}
      />
      <PastSeasons seasons={seasons} />
      {ctx.perms.manage_club ? (
        <Handover
          clubId={ctx.club.id}
          clubName={ctx.club.name}
          ownerName={
            owner
              ? personName({ displayName: owner.users?.display_name, claimedName: owner.claimed_name, rosterName: owner.roster_name })
              : "You"
          }
          candidates={candidates}
        />
      ) : null}
    </main>
  );
}

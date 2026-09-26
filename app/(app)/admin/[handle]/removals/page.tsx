/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";
import { ConfettiArt } from "@/components/soft/illustrations";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatDateTime } from "@/lib/format";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { RemovalDecision } from "./RemovalDecision";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Removal requests" };

function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "deletes on the next sweep";
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? "1 day to confirm" : `${days} days to confirm`;
}

export default async function RemovalsPage(props: PageProps<"/admin/[handle]/removals">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("media_removal_requests")
    .select("id, media_id, status, requested_at, auto_delete_at, resolved_at, requested_by")
    .eq("club_id", ctx.club.id)
    .order("status", { ascending: true })
    .order("requested_at", { ascending: false })
    .limit(30);

  const rows = requests ?? [];
  const mediaIds = rows.map((r) => r.media_id);
  const askerIds = [...new Set(rows.map((r) => r.requested_by).filter((id): id is string => Boolean(id)))];

  const [{ data: media }, { data: askers }] = await Promise.all([
    mediaIds.length
      ? supabase.from("media").select("id, album_id, display_path, thumb_path, original_filename").in("id", mediaIds)
      : Promise.resolve({ data: [] }),
    askerIds.length
      ? supabase.from("memberships").select("user_id, roster_name, claimed_name, users!memberships_user_id_fkey(display_name)").eq("club_id", ctx.club.id).in("user_id", askerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const byMedia = new Map((media ?? []).map((m) => [m.id, m]));
  const nameByUser = new Map(
    (askers ?? []).map((m) => [
      m.user_id,
      personName({ displayName: m.users?.display_name, claimedName: m.claimed_name, rosterName: m.roster_name }),
    ]),
  );
  const urls = await signPaths(
    supabase,
    (media ?? []).map((m) => m.display_path ?? m.thumb_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.display,
  );

  const open = rows.filter((r) => r.status === "open");
  const settled = rows.filter((r) => r.status !== "open");

  return (
    <main className="flex flex-col gap-7 px-4 py-8 sm:px-6">
      <PageTitle kicker={ctx.club.name} title="Removal requests">
        A member asked for a photo to come down. It is already hidden from everyone — you decide whether the original
        goes too.
      </PageTitle>

      {open.length === 0 ? (
        <EmptyState title="Nothing waiting on you." art={<ConfettiArt />}>
          When someone asks for a photo to come down it lands here, hidden from the club until you answer.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {open.map((request) => {
            const item = byMedia.get(request.media_id);
            const url = item ? urls.get(item.display_path ?? item.thumb_path ?? "") : null;
            const asker = request.requested_by ? (nameByUser.get(request.requested_by) ?? "A member") : "A member";
            return (
              <section key={request.id} className="soft-card grid gap-5 p-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[var(--soft-r-sm)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]">
                  {url ? (
                    <img src={url} alt={item?.original_filename ?? "The photo that was asked about"} className="block w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[4/3] items-center justify-center text-[14px] text-[color:var(--ink-70)]">
                      No preview
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="soft-chip">{daysLeft(request.auto_delete_at)}</span>
                    <span className="soft-chip soft-chip-muted">Hidden from members</span>
                  </div>
                  <div>
                    <span className="soft-display block text-[19px]">{asker} asked for this down</span>
                    <span className="block text-[14px] text-[color:var(--ink-70)]">
                      {formatDateTime(request.requested_at)} · no reason given, none needed
                    </span>
                  </div>
                  <p className="m-0 max-w-[52ch] text-[14px] text-[color:var(--ink-70)]">
                    It&apos;s already hidden from every member. Confirming deletes the original for good; putting it back
                    makes it visible again. If you do nothing, it deletes itself when the window runs out.
                  </p>
                  <RemovalDecision requestId={request.id} />
                  {item?.album_id ? (
                    <Link href={`/c/${handle}/a/${item.album_id}`} className="text-[14px] font-bold">
                      Open the album
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {settled.length ? (
        <section className="soft-card flex flex-col gap-3 p-5">
          <h2 className="soft-display text-[19px]">Settled</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {settled.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 text-[14px]">
                <span className="soft-chip soft-chip-muted">{request.status === "confirmed" ? "Deleted" : "Put back"}</span>
                <span className="text-[color:var(--ink-70)]">
                  asked {formatDateTime(request.requested_at)}
                  {request.resolved_at ? ` · settled ${formatDateTime(request.resolved_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatDate, formatDateTime } from "@/lib/format";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { RemovalDecision } from "./RemovalDecision";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Removal requests" };

function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "removed on the next sweep";
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

export default async function RemovalsPage(props: PageProps<"/admin/[handle]/removals">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  // Every open request, then the latest settled ones. Ordering by the status
  // text put "confirmed" before "open", so after 30 settled requests new ones
  // fell off the page and auto-deleted unseen.
  const select = "id, media_id, status, requested_at, auto_delete_at, resolved_at, requested_by";
  const [{ data: openRows }, { data: settledRows }] = await Promise.all([
    supabase.from("media_removal_requests").select(select).eq("event_id", ctx.event.id).eq("status", "open").order("requested_at", { ascending: true }),
    supabase
      .from("media_removal_requests")
      .select(select)
      .eq("event_id", ctx.event.id)
      .neq("status", "open")
      .order("requested_at", { ascending: false })
      .limit(30),
  ]);

  const rows = [...(openRows ?? []), ...(settledRows ?? [])];
  const mediaIds = rows.map((r) => r.media_id);
  const askerIds = [...new Set(rows.map((r) => r.requested_by).filter((id): id is string => Boolean(id)))];

  const [{ data: media }, { data: askers }] = await Promise.all([
    mediaIds.length
      ? supabase.from("media").select("id, album_id, display_path, thumb_path, original_filename, photographer_name, albums!media_album_id_fkey(title)").in("id", mediaIds)
      : Promise.resolve({ data: [] }),
    askerIds.length
      ? supabase.from("memberships").select("user_id, roster_name, claimed_name, users!memberships_user_id_fkey(display_name)").eq("event_id", ctx.event.id).in("user_id", askerIds)
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
    <main className="flex flex-col gap-6">
      <PageTitle kicker={ctx.event.name} title="Removal requests">
        Each photo is already hidden from attendees. Keep it removed or put it back within seven days. If you don&apos;t
        decide, it stays removed.
      </PageTitle>

      {open.length === 0 ? (
        <EmptyState title="Nothing waiting on you.">
          When someone asks for a photo to come down it lands here, hidden from the event until you answer.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {open.map((request, index) => {
            const item = byMedia.get(request.media_id);
            const url = item ? urls.get(item.display_path ?? item.thumb_path ?? "") : null;
            const asker = request.requested_by ? (nameByUser.get(request.requested_by) ?? "An attendee") : "An attendee";
            const albumTitle = item?.albums?.title ?? null;
            return (
              <section
                key={request.id}
                aria-label={`Request ${index + 1}`}
                className="grid items-start gap-5 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 md:grid-cols-[220px_minmax(0,1fr)_auto]"
              >
                <div className="relative overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                  {url ? (
                    <img src={url} alt={item?.original_filename ?? "The photo that was asked about"} className="block aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[4/3] items-center justify-center text-[14px] text-[color:var(--kb-ink-2)]">No preview</span>
                  )}
                  <span className="kb-chip absolute left-2 top-2 bg-[rgb(22_24_29/0.78)] text-white">Hidden</span>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <p className="m-0 text-[16px]">
                    <strong className="font-semibold">{asker}</strong> asked for this photo{albumTitle ? ` in ${albumTitle}` : ""} to come down.
                  </p>
                  <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">No reason given, none needed.</p>
                  <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
                    <span className="flex flex-col">
                      <dt className="text-[color:var(--kb-ink-3)]">Asked</dt>
                      <dd className="m-0">{formatDateTime(request.requested_at)}</dd>
                    </span>
                    <span className="flex flex-col">
                      <dt className="text-[color:var(--kb-ink-3)]">Decide by</dt>
                      <dd className="m-0">
                        {formatDate(request.auto_delete_at)} · {daysLeft(request.auto_delete_at)}
                      </dd>
                    </span>
                    {item?.photographer_name ? (
                      <span className="flex flex-col">
                        <dt className="text-[color:var(--kb-ink-3)]">Photographer</dt>
                        <dd className="m-0">{item.photographer_name}</dd>
                      </span>
                    ) : null}
                  </dl>
                  {item?.album_id ? (
                    <Link href={`/e/${handle}/a/${item.album_id}`} className="self-start text-[14px] font-medium">
                      Open the album
                    </Link>
                  ) : null}
                </div>

                <RemovalDecision requestId={request.id} />
              </section>
            );
          })}
        </div>
      )}

      {settled.length ? (
        <section aria-labelledby="settled" className="flex flex-col gap-3">
          <h2 id="settled" className="text-[17px] font-semibold">
            Settled
          </h2>
          <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white">
            <table className="kb-table">
              <thead>
                <tr>
                  <th scope="col">Photo</th>
                  <th scope="col">Album</th>
                  <th scope="col">Asked</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {settled.map((request) => {
                  const item = byMedia.get(request.media_id);
                  const url = item ? urls.get(item.display_path ?? item.thumb_path ?? "") : null;
                  return (
                    <tr key={request.id}>
                      <td>
                        <span className="block h-10 w-10 overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                          {url && request.status !== "confirmed" ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
                        </span>
                      </td>
                      <td>{item?.albums?.title ?? "Removed"}</td>
                      <td className="whitespace-nowrap">{formatDate(request.requested_at)}</td>
                      <td>
                        {request.status === "confirmed" ? (
                          <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Removed</span>
                        ) : (
                          <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">Put back</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}

import type { Metadata } from "next";
import { BillingGate } from "@/components/BillingGate";
import { EmptyState, PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { GuestLinkForm } from "./GuestLinkForm";
import { RevokeButton } from "./RevokeButton";

export const metadata: Metadata = { title: "Photographers" };

type LinkState = { label: string; tone: "live" | "muted" };

/** Two weeks after the event (or from today): time to edit and deliver, and a
 *  forgotten link still dies on its own. */
function defaultExpiryDate(eventEnd: string | null): string {
  const base = eventEnd ? new Date(`${eventEnd}T12:00:00+10:00`) : new Date();
  const when = new Date(Math.max(base.getTime(), Date.now()));
  when.setDate(when.getDate() + 14);
  return when.toISOString().slice(0, 10);
}

function stateOf(link: { revoked_at: string | null; expires_at: string }): LinkState {
  if (link.revoked_at) return { label: "Revoked", tone: "muted" };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { label: "Expired", tone: "muted" };
  return { label: "Active", tone: "live" };
}

export default async function PhotographersPage(props: PageProps<"/admin/[handle]/photographers">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const [{ data: links }, { data: albums }] = await Promise.all([
    supabase
      .from("album_guest_links")
      .select("id, label, album_id, expires_at, revoked_at, created_at, first_used_at, last_used_at, file_count, byte_total")
      .eq("event_id", ctx.event.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("albums")
      .select("id, title, status")
      .eq("event_id", ctx.event.id)
      .neq("status", "hidden")
      .order("album_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const albumTitle = new Map((albums ?? []).map((a) => [a.id, a.title]));
  const defaultExpiry = defaultExpiryDate(ctx.event.ends_on ?? ctx.event.starts_on);

  return (
    <main className="flex flex-col gap-6">
      <PageTitle kicker={ctx.event.name} title="Photographers">
        Each photographer gets their own upload link. They need no account, and every photo is credited to them.
      </PageTitle>

      {!canWrite(ctx.event) ? <BillingGate handle={handle} action="add photographers" deletedAt={ctx.event.photos_deleted_at} /> : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[2_1_560px]">
          {links?.length ? (
            <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white">
              <table className="kb-table">
                <thead>
                  <tr>
                    <th scope="col">Photographer</th>
                    <th scope="col">Album</th>
                    <th scope="col">Uploaded</th>
                    <th scope="col">Last upload</th>
                    <th scope="col">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const state = stateOf(link);
                    return (
                      <tr key={link.id}>
                        <td>
                          <span className="flex min-w-[180px] items-center gap-3">
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[13px] font-semibold text-[color:var(--kb-ink-2)]" aria-hidden>
                              {initials(link.label)}
                            </span>
                            <span className="flex min-w-0 flex-col leading-[1.35]">
                              <span className="font-medium">{link.label}</span>
                              <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                                {link.revoked_at
                                  ? `Revoked ${formatDate(link.revoked_at)}`
                                  : state.label === "Expired"
                                    ? `Expired ${formatDate(link.expires_at)}`
                                    : `Expires ${formatDate(link.expires_at)}`}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>{albumTitle.get(link.album_id) ?? "Removed album"}</td>
                        <td>
                          {link.file_count > 0 ? (
                            <>
                              <span className="mono">{link.file_count.toLocaleString("en-AU")}</span>
                              <span className="text-[color:var(--kb-ink-3)]"> · {formatBytes(link.byte_total)}</span>
                            </>
                          ) : (
                            <span className="text-[color:var(--kb-ink-3)]">Not used yet</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">{link.last_used_at ? formatDateTime(link.last_used_at) : "Never"}</td>
                        <td>
                          {state.tone === "live" ? (
                            <RevokeButton linkId={link.id} label={link.label} />
                          ) : (
                            <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">{state.label}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No photographers yet">
              Add one for each photographer. You can make several links for the same person, one per album.
            </EmptyState>
          )}
          <p className="mt-3 text-[14px] text-[color:var(--kb-ink-3)]">
            Links are shown once, when they&apos;re made. Lost one? Revoke it and make a new one.
          </p>
        </div>

        <div className="min-w-0 flex-[1_1_320px] lg:max-w-[380px]">
          <GuestLinkForm eventId={ctx.event.id} handle={handle} albums={albums ?? []} defaultExpiry={defaultExpiry} />
        </div>
      </div>
    </main>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

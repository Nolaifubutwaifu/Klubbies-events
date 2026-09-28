import type { Metadata } from "next";
import { BillingGate } from "@/components/BillingGate";
import { EmptyState, PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { formatBytes, formatDate } from "@/lib/format";
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
      .limit(40),
  ]);

  const albumTitle = new Map((albums ?? []).map((a) => [a.id, a.title]));
  const defaultExpiry = defaultExpiryDate(ctx.event.ends_on ?? ctx.event.starts_on);

  return (
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={ctx.event.name} title="Photographers">
        Each photographer gets their own upload link. No account and no app: they open it in a browser, drop the
        files, and every photo is credited to them.
      </PageTitle>

      {!canWrite(ctx.event) ? <BillingGate handle={handle} action="add photographers" /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <GuestLinkForm eventId={ctx.event.id} albums={albums ?? []} defaultExpiry={defaultExpiry} />

        <div className="flex flex-col gap-6">
          <section className="soft-card flex flex-col gap-4 p-5">
            <h2 className="text-[16px] font-semibold">Upload links</h2>
            {links?.length ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {links.map((link) => {
                  const state = stateOf(link);
                  return (
                    <li
                      key={link.id}
                      className="flex flex-wrap items-center gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] p-3.5"
                    >
                      <span className="min-w-[200px] flex-1">
                        <span className="block text-[14px] font-medium">{link.label}</span>
                        <span className="block text-[14px] text-[color:var(--ink-70)]">
                          {[
                            link.revoked_at
                              ? `Revoked ${formatDate(link.revoked_at)}`
                              : `Created ${formatDate(link.created_at)} · expires ${formatDate(link.expires_at)}`,
                            `${link.file_count.toLocaleString("en-AU")} file${link.file_count === 1 ? "" : "s"}`,
                            link.byte_total > 0 ? formatBytes(link.byte_total) : null,
                            albumTitle.get(link.album_id) ?? null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className={state.tone === "live" ? "soft-chip" : "soft-chip soft-chip-muted"}>{state.label}</span>
                      {state.tone === "live" ? <RevokeButton linkId={link.id} label={link.label} /> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No photographers yet">
                Add one for each photographer. You can make several links for the same person, one per album.
              </EmptyState>
            )}
          </section>

          <section className="soft-card flex flex-col gap-3 p-5">
            <span className="block text-[14px] font-medium">What the photographer sees</span>
            <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
              Your event&apos;s name and logo, the album, and one drop zone. Uploads resume if the connection drops, and
              duplicates are skipped. Photographers with an account can instead be added as Photographer on the
              Attendees page.
            </p>
            <div className="rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] p-4">
              <span className="block text-[14px] text-[color:var(--ink-70)]">Uploading to {ctx.event.name}</span>
              <span className="mt-0.5 block text-[16px] font-semibold">{albums?.[0]?.title ?? "Your album"}</span>
              <span className="mt-3 flex h-[76px] items-center justify-center rounded-[8px] border border-dashed border-[color:var(--kb-line-input)] bg-white text-[14px] text-[color:var(--ink-70)]">
                Drop photos and videos here
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

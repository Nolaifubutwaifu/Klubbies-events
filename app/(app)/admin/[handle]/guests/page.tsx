import type { Metadata } from "next";
import { BillingGate } from "@/components/BillingGate";
import { EmptyState, PageTitle } from "@/components/ui";
import { PhotoStackArt } from "@/components/soft/illustrations";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { formatBytes, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { GuestLinkForm } from "./GuestLinkForm";
import { RevokeButton } from "./RevokeButton";

export const metadata: Metadata = { title: "Guest links" };

type LinkState = { label: string; tone: "live" | "muted" };

/** A month: long enough for a photographer to get around to it, short enough
 *  that a forgotten link dies on its own. */
function defaultExpiryDate(): string {
  const when = new Date();
  when.setDate(when.getDate() + 30);
  return when.toISOString().slice(0, 10);
}

function stateOf(link: { revoked_at: string | null; expires_at: string }): LinkState {
  if (link.revoked_at) return { label: "Revoked", tone: "muted" };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { label: "Expired", tone: "muted" };
  return { label: "Active", tone: "live" };
}

export default async function GuestLinksPage(props: PageProps<"/admin/[handle]/guests">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const [{ data: links }, { data: albums }] = await Promise.all([
    supabase
      .from("album_guest_links")
      .select("id, label, album_id, expires_at, revoked_at, created_at, first_used_at, last_used_at, file_count, byte_total")
      .eq("club_id", ctx.club.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("albums")
      .select("id, title, status")
      .eq("club_id", ctx.club.id)
      .neq("status", "hidden")
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const albumTitle = new Map((albums ?? []).map((a) => [a.id, a.title]));
  const defaultExpiry = defaultExpiryDate();

  return (
    <main className="flex flex-col gap-7 px-4 py-8 sm:px-6">
      <PageTitle kicker={ctx.club.name} title="Guest links">
        For the photographer you hired, or the one mate with the good camera. They can upload into one album and see
        nothing else.
      </PageTitle>

      {!canWrite(ctx.club.billing_status) ? <BillingGate handle={handle} action="hand out guest links" /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <GuestLinkForm clubId={ctx.club.id} albums={albums ?? []} defaultExpiry={defaultExpiry} />

        <div className="flex flex-col gap-6">
          <section className="soft-card flex flex-col gap-4 p-5">
            <h2 className="soft-display text-[19px]">Active and past links</h2>
            {links?.length ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {links.map((link) => {
                  const state = stateOf(link);
                  return (
                    <li
                      key={link.id}
                      className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--color-text)_7%,transparent)] bg-[color:var(--color-bg)] p-3.5"
                    >
                      <span className="min-w-[200px] flex-1">
                        <span className="block text-[14px] font-bold">{link.label}</span>
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
              <EmptyState title="No guest links yet." art={<PhotoStackArt size={104} />}>
                Make one when you hire a photographer. They upload into a single album and never see the club.
              </EmptyState>
            )}
          </section>

          <section className="rounded-[var(--soft-r)] bg-[color:var(--tone-support)] p-5 text-[color:var(--tone-support-ink)]">
            <span className="block text-[14px] font-bold">This is all your photographer sees</span>
            <p className="m-0 mt-1 text-[14px]">
              No login, no roster, no other albums — one drop zone and the album name. They drop files and close the tab.
              Everything they add shows as &ldquo;added by guest&rdquo; in your album.
            </p>
            <div className="mt-4 rounded-[var(--soft-r-sm)] bg-[color:var(--color-surface)] p-4 text-[color:var(--color-text)]">
              <span className="block text-[14px] font-bold text-[color:var(--ink-70)]">Upload for {ctx.club.name}</span>
              <span className="soft-display mt-1 block text-[18px]">
                {albums?.[0]?.title ?? "Your album"}
              </span>
              <span className="mt-3 flex h-[76px] items-center justify-center rounded-[var(--soft-r-sm)] border border-dashed border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] text-[14px] text-[color:var(--ink-70)]">
                Drop photos and videos here
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

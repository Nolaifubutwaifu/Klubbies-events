import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { Fragment } from "react";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 100;

/** Today and yesterday as formatDate writes them, Brisbane time. */
function recentDays(): { today: string; yesterday: string } {
  const now = Date.now();
  return { today: formatDate(new Date(now).toISOString()), yesterday: formatDate(new Date(now - 86_400_000).toISOString()) };
}

export default async function ActivityPage(props: PageProps<"/admin/[handle]/activity">) {
  const { handle } = await props.params;
  const search = await props.searchParams;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const action = search.action === "view" || search.action === "download" ? search.action : undefined;
  const page = Math.max(0, Number(search.page) || 0);

  let query = supabase
    .from("access_events")
    .select("id, action, occurred_at, user_agent, memberships(roster_name, roster_email, claimed_name, users!memberships_user_id_fkey(display_name)), media(id, album_id, original_filename, albums!media_album_id_fkey(title))")
    .eq("event_id", ctx.event.id)
    .order("occurred_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (action === "download") query = query.in("action", ["download", "zip"]);
  else if (action) query = query.eq("action", action);
  const { data } = await query;
  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (data?.length ?? 0) > PAGE_SIZE;

  const href = (params: { action?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params.action) sp.set("action", params.action);
    if (params.page) sp.set("page", String(params.page));
    const s = sp.toString();
    return `/admin/${handle}/activity${s ? `?${s}` : ""}`;
  };

  // Rows grouped by day, Brisbane time, with Today and Yesterday said in words.
  const dayKey = (iso: string) => formatDate(iso);
  const { today, yesterday } = recentDays();
  const dayLabel = (key: string) => (key === today ? "Today" : key === yesterday ? "Yesterday" : key);
  const hhmm = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Australia/Brisbane" });

  const icon = (kind: string) =>
    kind === "view" ? (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
    );

  return (
    <main className="flex flex-col gap-6">
      <PageTitle kicker={ctx.event.name} title="Activity log">
        Who opened and downloaded what, most recent first.
      </PageTitle>
      <div className="flex flex-wrap gap-2">
        {(
          [
            [undefined, "Everything"],
            ["view", "Views"],
            ["download", "Downloads"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={label}
            href={href({ action: value })}
            aria-current={action === value ? "page" : undefined}
            className={`flex min-h-[40px] items-center rounded-[8px] border px-3.5 text-[14px] font-medium no-underline ${
              action === value
                ? "border-[color:var(--kb-ink)] bg-[color:var(--kb-ink)] text-white"
                : "border-[color:var(--kb-line)] bg-white text-[color:var(--kb-ink-2)] hover:border-[color:var(--kb-line-strong)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[3_1_560px]">
          {rows.length === 0 ? (
            <p className="rounded-[10px] border border-[color:var(--kb-line)] bg-white p-6 text-[14px] text-[color:var(--kb-ink-2)]">Nothing logged yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white" tabIndex={0} role="region" aria-label="Activity log">
              <table className="kb-table min-w-[600px]">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Who</th>
                    <th scope="col">Action</th>
                    <th scope="col">Item</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e, index) => {
                    const key = dayKey(e.occurred_at);
                    const newDay = index === 0 || dayKey(rows[index - 1].occurred_at) !== key;
                    const album = e.media?.albums?.title;
                    return (
                      <Fragment key={e.id}>
                        {newDay ? (
                          <tr className="hover:!bg-transparent">
                            <td colSpan={4} className="!bg-[color:var(--kb-cream)] !py-2 text-[14px] font-semibold text-[color:var(--kb-ink-2)]">
                              {dayLabel(key)}
                            </td>
                          </tr>
                        ) : null}
                        <tr>
                          <td className="mono whitespace-nowrap text-[color:var(--kb-ink-2)]">{hhmm.format(new Date(e.occurred_at))}</td>
                          <td>
                            {e.memberships
                              ? personName({
                                  displayName: e.memberships.users?.display_name,
                                  claimedName: e.memberships.claimed_name,
                                  rosterName: e.memberships.roster_name,
                                })
                              : "An organiser"}
                          </td>
                          <td>
                            <span className="flex items-center gap-2 whitespace-nowrap">
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-[6px] ${e.action === "view" ? "bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]" : "bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]"}`}
                                aria-hidden
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  {icon(e.action)}
                                </svg>
                              </span>
                              {e.action === "view" ? "Viewed" : "Downloaded"}
                            </span>
                          </td>
                          <td>
                            {e.media?.album_id ? (
                              <Link href={`/e/${handle}/a/${e.media.album_id}/${e.media.id}`}>
                                {e.media.original_filename ?? "A photo"}
                                {album ? <span className="text-[color:var(--kb-ink-3)]"> · {album}</span> : null}
                              </Link>
                            ) : e.action === "zip" ? (
                              <span>A zip of photos</span>
                            ) : (
                              <span className="text-[color:var(--kb-ink-3)]">Deleted item</span>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <nav className="mt-4 flex justify-between">
            {page > 0 ? (
              <Link className="btn btn-secondary no-underline" href={href({ action, page: page - 1 })}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            {hasMore ? (
              <Link className="btn btn-secondary no-underline" href={href({ action, page: page + 1 })}>
                Older
              </Link>
            ) : null}
          </nav>
        </div>

        <aside aria-labelledby="why" className="flex min-w-0 flex-[1_1_260px] flex-col gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 lg:max-w-[320px]">
          <h2 id="why" className="text-[17px] font-semibold">
            What this is for
          </h2>
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
            Every view and download is tied to a confirmed email, so you can tell a client the photos reached people, or
            find out who opened a photo that turned up somewhere it shouldn&apos;t.
          </p>
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
            Only people who run the event see this page. Attendees are told this log exists in the privacy policy.
          </p>
        </aside>
      </div>
    </main>
  );
}

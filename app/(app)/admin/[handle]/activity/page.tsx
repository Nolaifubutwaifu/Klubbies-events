import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 100;

export default async function ActivityPage(props: PageProps<"/admin/[handle]/activity">) {
  const { handle } = await props.params;
  const search = await props.searchParams;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const action = search.action === "view" || search.action === "download" ? search.action : undefined;
  const page = Math.max(0, Number(search.page) || 0);

  let query = supabase
    .from("access_events")
    .select("id, action, occurred_at, user_agent, memberships(roster_name, roster_email, claimed_name, users!memberships_user_id_fkey(display_name)), media(id, album_id, original_filename)")
    .eq("club_id", ctx.club.id)
    .order("occurred_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (action) query = query.eq("action", action);
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

  return (
    <main className="flex max-w-[1040px] flex-col gap-6 px-6 py-8">
      <PageTitle kicker={ctx.club.name} title="Activity">
        Every view and download, newest first. Members are told this log exists.
      </PageTitle>
      <div className="flex flex-col gap-2 soft-card p-4 text-[14px] leading-normal text-ink-70">
        <span className="soft-display text-[16px]">What this is for</span>
        <p className="m-0 max-w-[70ch]">
          If a photo from your club turns up somewhere it shouldn&apos;t, this is how you find out who opened or
          downloaded it, and when. It&apos;s also the quickest way to see whether an album actually reached people
          after you published it, and which members have never opened anything.
        </p>
        <p className="m-0 max-w-[70ch] text-[color:var(--ink-70)]">
          Only people who can run the club see this page. The privacy policy tells members the log exists.
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        <Link href={href({})} className="btn btn-secondary text-[14px]" aria-pressed={!action}>
          Everything
        </Link>
        <Link href={href({ action: "view" })} className="btn btn-secondary text-[14px]" aria-pressed={action === "view"}>
          Views
        </Link>
        <Link href={href({ action: "download" })} className="btn btn-secondary text-[14px]" aria-pressed={action === "download"}>
          Downloads
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="soft-card p-6 text-[14px] text-[color:var(--ink-70)]">Nothing logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-[color:var(--ink-70)]">{formatDateTime(e.occurred_at)}</td>
                  <td>
                    <span className="font-semibold">
                      {e.memberships
                        ? personName({
                            displayName: e.memberships.users?.display_name,
                            claimedName: e.memberships.claimed_name,
                            rosterName: e.memberships.roster_name,
                          })
                        : "Admin"}
                    </span>
                    {e.memberships ? <div className="text-[14px] text-[color:var(--ink-55)]">{e.memberships.roster_email}</div> : null}
                  </td>
                  <td>
                    <span className={e.action === "download" ? "tag tag-accent" : "tag tag-neutral"}>{e.action}</span>
                  </td>
                  <td>
                    {e.media?.album_id ? (
                      <Link href={`/c/${handle}/a/${e.media.album_id}/${e.media.id}`}>{e.media.original_filename ?? "Open"}</Link>
                    ) : (
                      <span className="text-[color:var(--ink-55)]">Deleted item</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="flex justify-between">
        {page > 0 ? (
          <Link className="btn btn-secondary" href={href({ action, page: page - 1 })}>
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link className="btn btn-secondary" href={href({ action, page: page + 1 })}>
            Older →
          </Link>
        ) : null}
      </nav>
    </main>
  );
}

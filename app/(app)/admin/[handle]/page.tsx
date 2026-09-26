/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { MoreLink, MoreMenu } from "@/components/MoreMenu";
import { PageTitle, Stat } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatBytes, formatDate, formatDateTime, plural } from "@/lib/format";
import { listStackedAlbums } from "@/lib/media/album-list";
import { EXPIRE_AFTER_DAYS, STUCK_AFTER_MS } from "@/lib/media/constants";
import { createClient } from "@/lib/supabase/server";
import { personName } from "@/lib/auth/display-name";

export const metadata: Metadata = { title: "Admin" };

/** Cutoff for the "views this week" figure. */
function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

/** Uploads started before this and still unfinished have stopped. */
function stuckCutoff(): string {
  return new Date(Date.now() - STUCK_AFTER_MS).toISOString();
}

export default async function AdminDashboard(props: PageProps<"/admin/[handle]">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const clubId = ctx.club.id;

  const count = (status?: string) => {
    let q = supabase.from("memberships").select("id", { count: "exact", head: true }).eq("club_id", clubId);
    q = status ? q.eq("status", status) : q.in("status", ["pending", "active", "grace"]);
    return q;
  };

  const [
    onList,
    active,
    pending,
    grace,
    albumCount,
    published,
    usage,
    mismatches,
    activity,
    stacked,
    viewsWeek,
    removals,
    engagement,
    readyItems,
    stuck,
  ] = await Promise.all([
      count(),
      count("active"),
      count("pending"),
      count("grace"),
      supabase.from("albums").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      supabase.from("albums").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "published"),
      supabase.from("club_storage_usage").select("*").eq("club_id", clubId).maybeSingle(),
      supabase
        .from("memberships")
        .select("id, roster_name, claimed_name, roster_email")
        .eq("club_id", clubId)
        .eq("name_mismatch", true)
        .in("status", ["active", "grace"])
        .limit(5),
      supabase
        .from("access_events")
        .select("id, action, occurred_at, memberships(roster_name, claimed_name, users!memberships_user_id_fkey(display_name)), media(original_filename)")
        .eq("club_id", clubId)
        .order("occurred_at", { ascending: false })
        .limit(6),
      listStackedAlbums(supabase, clubId, { includeDrafts: true, limit: 4 }),
      supabase
        .from("access_events")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("action", "view")
        .gte("occurred_at", sevenDaysAgo()),
      supabase
        .from("media_removal_requests")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("status", "open"),
      supabase.from("album_engagement").select("*").eq("club_id", clubId),
      // What members can actually open, the same rule as album_media_counts.
      // club_storage_usage counts every row, finished or not, which is how
      // this page said 114 while the album said 110.
      supabase.from("media").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "ready"),
      // Uploads that stopped. Given an hour, so one still going isn't flagged.
      supabase
        .from("media")
        .select("id, album_id, albums!media_album_id_fkey(title)", { count: "exact" })
        .eq("club_id", clubId)
        .neq("status", "ready")
        .lt("created_at", stuckCutoff())
        .order("created_at", { ascending: true })
        .limit(50),
    ]);

  const drafts = (albumCount.count ?? 0) - (published.count ?? 0);
  const firstRun = (onList.count ?? 0) <= 1 && (albumCount.count ?? 0) === 0;
  const openRemovals = removals.count ?? 0;
  const stuckCount = stuck.count ?? 0;
  const stuckAlbums = [
    ...new Map(
      (stuck.data ?? []).filter((row) => row.album_id).map((row) => [row.album_id!, row.albums?.title ?? "an album"]),
    ),
  ];

  const views = new Map((engagement.data ?? []).map((row) => [row.album_id, row]));
  const mostOpened = [...(engagement.data ?? [])].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))[0];
  const mostOpenedTitle = mostOpened ? stacked.find((a) => a.id === mostOpened.album_id)?.title : null;

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Brisbane",
  });

  // The committee screen is a control panel: what needs doing, then the
  // numbers, then the evidence.
  const tasks = [
    openRemovals > 0
      ? {
          key: "removals",
          title: `${openRemovals} photo${openRemovals === 1 ? "" : "s"} asked to come down`,
          body: "Already hidden from members. Confirm or put back within seven days.",
          href: `/admin/${handle}/removals`,
          cta: "Review",
          urgent: true,
        }
      : null,
    stuckCount > 0
      ? {
          key: "unfinished",
          title: `${plural(stuckCount, "upload")} didn't finish`,
          body: `In ${stuckAlbums.map(([, title]) => title).join(", ")}. Members can't see them. Upload them again or remove them; they clear themselves after ${EXPIRE_AFTER_DAYS} days.`,
          href: stuckAlbums[0] ? `/c/${handle}/a/${stuckAlbums[0][0]}` : `/admin/${handle}/albums`,
          cta: "Fix",
          urgent: true,
        }
      : null,
    mismatches.data?.length
      ? {
          key: "names",
          title: `${mismatches.data.length} member${mismatches.data.length === 1 ? "" : "s"} signed in under a different name`,
          body: mismatches.data.map((m) => m.roster_name).join(", "),
          href: `/admin/${handle}/members`,
          cta: "Review",
          urgent: true,
        }
      : null,
    drafts > 0
      ? {
          key: "drafts",
          title: `${drafts} album${drafts === 1 ? "" : "s"} still in draft`,
          body: "Nobody in the club can see a draft yet.",
          href: `/admin/${handle}/albums`,
          cta: "Publish",
          urgent: true,
        }
      : null,
    (pending.count ?? 0) > 0
      ? {
          key: "pending",
          title: `${plural(pending.count ?? 0, "member")} ${(pending.count ?? 0) === 1 ? "has" : "have"} never signed in`,
          // No guess about who they are: "mostly first years" read oddly for
          // a club with one pending member.
          body: "On the member list, but they haven't opened Klubbies yet.",
          href: `/admin/${handle}/members`,
          cta: "Open members",
          urgent: false,
        }
      : null,
  ].filter((task): task is NonNullable<typeof task> => task !== null);

  return (
    <main className="flex flex-col gap-7 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle kicker={ctx.club.name} title={today}>
          {tasks.length
            ? `${plural(tasks.length, "thing")} ${tasks.length === 1 ? "needs" : "need"} you. Everything else is running itself.`
            : "Nothing needs you. Everything is running itself."}
        </PageTitle>
        <div className="flex items-center gap-2">
          <Link href={`/admin/${handle}/upload`} className={`btn ${firstRun ? "btn-secondary" : "btn-primary"}`}>
            New album
          </Link>
          <MoreMenu iconOnly label="More actions">
            <MoreLink href={`/c/${handle}`}>See it as a member</MoreLink>
            <MoreLink href={`/admin/${handle}/guests`}>Make a guest upload link</MoreLink>
            <MoreLink href={`/admin/${handle}/activity`}>Full activity log</MoreLink>
          </MoreMenu>
        </div>
      </div>

      {firstRun ? (
        <div className="kb-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <span className="soft-chip">Getting started</span>
            <div className="soft-display mt-2 text-[20px]">Five minutes, once. Then every event is a drag and drop.</div>
          </div>
          <Link href={`/admin/${handle}/setup`} className="btn btn-primary">
            Open the checklist
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))" }}>
        <Stat
          value={(onList.count ?? 0).toLocaleString("en-AU")}
          label="Members"
          hint={`${(active.count ?? 0).toLocaleString("en-AU")} signed in`}
        />
        <Stat
          value={(albumCount.count ?? 0).toLocaleString("en-AU")}
          label="Albums"
          hint={drafts > 0 ? plural(drafts, "draft") : "all published"}
          tone={drafts > 0 ? "attention" : "plain"}
        />
        <Stat
          value={(readyItems.count ?? 0).toLocaleString("en-AU")}
          label="Photos and videos"
          hint={stuckCount > 0 ? `${stuckCount.toLocaleString("en-AU")} unfinished` : "originals kept"}
          tone={stuckCount > 0 ? "attention" : "plain"}
        />
        <Stat value={formatBytes(usage.data?.total_bytes ?? 0)} label="Storage" hint="Included" />
        <Stat
          value={(viewsWeek.count ?? 0).toLocaleString("en-AU")}
          label="Views this week"
          hint={(viewsWeek.count ?? 0) > 0 ? "members opening albums" : "nothing opened yet"}
          tone={(viewsWeek.count ?? 0) > 0 ? "good" : "plain"}
        />
        <Stat
          value={(grace.count ?? 0).toLocaleString("en-AU")}
          label="Winding down"
          hint={(grace.count ?? 0) > 0 ? "30 day access window" : "nobody leaving"}
          tone={(grace.count ?? 0) > 0 ? "attention" : "plain"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="soft-card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <h2 className="soft-display text-[19px]">Needs you</h2>
              {tasks.length ? <span className="soft-chip">{tasks.length}</span> : <span className="soft-chip soft-chip-muted">All clear</span>}
            </div>
            {tasks.length ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {tasks.map((task) => (
                  <li
                    key={task.key}
                    className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--color-text)_7%,transparent)] bg-[color:var(--color-bg)] p-3.5"
                  >
                    <span
                      className={`h-[7px] w-[7px] flex-none rounded-full ${task.urgent ? "bg-accent" : "bg-[color:var(--color-neutral-400)]"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">{task.title}</span>
                      <span className="block truncate text-[14px] text-[color:var(--ink-70)]">{task.body}</span>
                    </span>
                    <Link
                      href={task.href}
                      className="btn btn-ghost"
                    >
                      {task.cta}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                Nothing waiting on you. Every album is published and everyone on the list has signed in.
              </p>
            )}
          </section>

          <section className="soft-card flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="soft-display text-[19px]">Recent albums</h2>
              <Link href={`/admin/${handle}/albums`} className="text-[14px] font-bold">
                See all {(albumCount.count ?? 0).toLocaleString("en-AU")}
              </Link>
            </div>
            {stacked.length ? (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {stacked.map((album) => {
                  const row = views.get(album.id);
                  return (
                    <Link key={album.id} href={`/c/${handle}/a/${album.id}`} className="flex flex-col gap-2 text-ink no-underline">
                      <span className="soft-tile relative block aspect-[4/3]">
                        {album.coverUrl ? <img src={album.coverUrl} alt="" loading="lazy" /> : null}
                        {album.status !== "published" ? (
                          <span className="absolute left-2 top-2 rounded-full bg-[rgba(25,18,22,0.72)] px-2.5 py-0.5 text-[14px] font-bold text-white">
                            {album.status === "hidden" ? "Hidden" : "Draft"}
                          </span>
                        ) : null}
                      </span>
                      <span>
                        <span className="block truncate text-[14px] font-bold">{album.title}</span>
                        <span className="block text-[14px] text-[color:var(--ink-70)]">
                          {(album.photoCount + album.videoCount).toLocaleString("en-AU")} ·{" "}
                          {album.status === "published"
                            ? plural(row?.view_count ?? 0, "view")
                            : "not live"}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                Nothing uploaded yet. Your newest albums will show up here.
              </p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="soft-card flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="soft-display text-[19px]">Activity</h2>
              <Link href={`/admin/${handle}/activity`} className="text-[14px] font-bold">
                Full log
              </Link>
            </div>
            {activity.data?.length ? (
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                {activity.data.map((e, i) => (
                  <li key={e.id} className="flex gap-3">
                    <span
                      className={`mt-[7px] h-2 w-2 flex-none rounded-full ${i === 0 ? "bg-accent" : "bg-[color:var(--color-neutral-400)]"}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px]">
                        <strong className="font-bold">
                          {e.memberships
                            ? personName({
                                displayName: e.memberships.users?.display_name,
                                claimedName: e.memberships.claimed_name,
                                rosterName: e.memberships.roster_name,
                              })
                            : "Admin"}
                        </strong>{" "}
                        {e.action === "download" ? "downloaded" : "viewed"} {e.media?.original_filename ?? "an item"}
                      </span>
                      <span className="block text-[14px] text-[color:var(--ink-55)]">{formatDateTime(e.occurred_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                No views yet. Once members open an album, you&apos;ll see who looked at what.
              </p>
            )}
          </section>

          {mostOpenedTitle ? (
            <section className="rounded-[var(--soft-r)] bg-[color:var(--tone-support)] p-5 text-[color:var(--tone-support-ink)]">
              <span className="block text-[14px] font-bold">Most opened album</span>
              <span className="soft-display mt-1 block text-[21px] text-ink">{mostOpenedTitle}</span>
              <span className="mt-1 block text-[14px]">
                {plural(mostOpened?.view_count ?? 0, "view")} · {plural(mostOpened?.download_count ?? 0, "download")} ·{" "}
                {plural(mostOpened?.member_count ?? 0, "member")}
              </span>
            </section>
          ) : null}

          <section className="soft-card flex flex-col gap-2 p-5">
            <span className="text-[14px] font-bold">Guest links</span>
            <span className="text-[14px] text-[color:var(--ink-70)]">
              Hired a photographer? Give them a link that uploads into one album and shows them nothing else.
            </span>
            <Link href={`/admin/${handle}/guests`} className="kb-link self-start">
              Make a guest link
            </Link>
          </section>

          {stacked[0] ? (
            <p className="m-0 text-[14px] text-[color:var(--ink-55)]">
              Newest album added {formatDate(stacked[0].date)}.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

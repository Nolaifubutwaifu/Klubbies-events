/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { MoreLink, MoreMenu } from "@/components/MoreMenu";
import { PageTitle, Stat } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { personName } from "@/lib/auth/display-name";
import { accessHasEnded } from "@/lib/auth/session";
import { canWrite } from "@/lib/billing/status";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { formatDateTime, formatEventDates, formatLongDate, plural } from "@/lib/format";
import { listStackedAlbums } from "@/lib/media/album-list";
import { EXPIRE_AFTER_DAYS, STUCK_AFTER_MS } from "@/lib/media/constants";
import { eventLink, eventQrSvg } from "@/lib/share";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

/** Uploads started before this and still unfinished have stopped. */
function stuckCutoff(): string {
  return new Date(Date.now() - STUCK_AFTER_MS).toISOString();
}

export default async function OrganiserOverview(props: PageProps<"/admin/[handle]">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const { event } = ctx;
  const eventId = event.id;

  const [
    joined,
    onList,
    albumCount,
    published,
    readyItems,
    downloads,
    removals,
    stuck,
    activity,
    stacked,
    photographerLinks,
    findable,
    qrSvg,
  ] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "active"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["pending", "active"]),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "published"),
    // What attendees can actually open: finished files.
    supabase.from("media").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "ready"),
    supabase
      .from("access_events")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("action", ["download", "zip"]),
    supabase.from("media_removal_requests").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "open"),
    supabase
      .from("media")
      .select("id, album_id, albums!media_album_id_fkey(title)", { count: "exact" })
      .eq("event_id", eventId)
      .neq("status", "ready")
      .lt("created_at", stuckCutoff())
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("access_events")
      .select("id, action, occurred_at, memberships(roster_name, claimed_name, users!memberships_user_id_fkey(display_name)), media(original_filename)")
      .eq("event_id", eventId)
      .order("occurred_at", { ascending: false })
      .limit(6),
    listStackedAlbums(supabase, eventId, { includeDrafts: true, limit: 4 }),
    supabase.from("album_guest_links").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    // How many attendees found themselves. A count only, read with the
    // service role after the organiser check above: profiles are private to
    // their owners, and nothing here says who.
    createAdminClient()
      .from("member_face_profiles")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "ready"),
    eventQrSvg(handle),
  ]);

  const drafts = (albumCount.count ?? 0) - (published.count ?? 0);
  const openRemovals = removals.count ?? 0;
  const stuckCount = stuck.count ?? 0;
  const stuckAlbums = [
    ...new Map((stuck.data ?? []).filter((row) => row.album_id).map((row) => [row.album_id!, row.albums?.title ?? "an album"])),
  ];
  const writable = canWrite(event);
  const inApp = await isNativeAppRequest();
  const firstRun = (albumCount.count ?? 0) === 0;
  const link = eventLink(handle);
  const closed = accessHasEnded(event);

  // What needs doing, then the numbers, then the evidence.
  const tasks = [
    !writable
      ? {
          key: "billing",
          title: inApp ? "The event isn't active yet" : "Activate the event",
          body: inApp
            ? "Uploading, photographer links and attendee invites are switched off until it is."
            : "Uploading, photographer links and attendee invites unlock after payment.",
          href: `/admin/${handle}/billing`,
          cta: inApp ? "Status" : "Activate",
          urgent: true,
        }
      : null,
    openRemovals > 0
      ? {
          key: "removals",
          title: `${plural(openRemovals, "photo")} asked to come down`,
          body: "Already hidden from attendees. Confirm or put back within seven days.",
          href: `/admin/${handle}/removals`,
          cta: "Review",
          urgent: true,
        }
      : null,
    stuckCount > 0
      ? {
          key: "unfinished",
          title: `${plural(stuckCount, "upload")} didn't finish`,
          body: `In ${stuckAlbums.map(([, title]) => title).join(", ")}. Attendees can't see them. Upload them again or remove them; they clear themselves after ${EXPIRE_AFTER_DAYS} days.`,
          href: stuckAlbums[0] ? `/e/${handle}/a/${stuckAlbums[0][0]}` : `/admin/${handle}/albums`,
          cta: "Fix",
          urgent: true,
        }
      : null,
    writable && (photographerLinks.count ?? 0) === 0 && (readyItems.count ?? 0) === 0
      ? {
          key: "photographer",
          title: "No photographer link yet",
          body: "Give each photographer their own upload link. They need no account.",
          href: `/admin/${handle}/photographers`,
          cta: "Add photographer",
          urgent: false,
        }
      : null,
    drafts > 0
      ? {
          key: "drafts",
          title: `${plural(drafts, "album")} still in draft`,
          body: "Attendees can't see a draft yet.",
          href: `/admin/${handle}/albums`,
          cta: "Publish",
          urgent: false,
        }
      : null,
    (published.count ?? 0) > 0 && (joined.count ?? 0) <= 1
      ? {
          key: "share",
          title: "Photos are live, but nobody has joined yet",
          body: "Send the announcement email or put the QR code on screen.",
          href: `/admin/${handle}/share`,
          cta: "Share",
          urgent: false,
        }
      : null,
  ].filter((task): task is NonNullable<typeof task> => task !== null);

  return (
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle kicker={formatEventDates(event.starts_on, event.ends_on) || "Overview"} title={event.name}>
          {closed
            ? `The gallery closed to attendees on ${formatLongDate(event.access_ends_at)}. You still have full access.`
            : event.access_ends_at
              ? `Open to attendees until ${formatLongDate(event.access_ends_at)}. ${event.access_mode === "link" ? "Anyone with the link can join." : "Guest list only."}`
              : event.access_mode === "link"
                ? "Anyone with the link can join."
                : "Guest list only."}
        </PageTitle>
        <div className="flex items-center gap-2">
          <Link href={`/admin/${handle}/upload`} className="btn btn-primary no-underline">
            New album
          </Link>
          <MoreMenu iconOnly label="More actions">
            <MoreLink href={`/e/${handle}`}>See it as an attendee</MoreLink>
            <MoreLink href={`/admin/${handle}/setup`}>Setup checklist</MoreLink>
            <MoreLink href={`/admin/${handle}/activity`}>Full activity log</MoreLink>
          </MoreMenu>
        </div>
      </div>

      {firstRun ? (
        <div className="soft-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <span className="kb-eyebrow">Getting started</span>
            <div className="mt-1 text-[18px] font-semibold">Six steps, about ten minutes. Then photographers take it from there.</div>
          </div>
          <Link href={`/admin/${handle}/setup`} className="btn btn-secondary no-underline">
            Open the checklist
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Stat
          value={(readyItems.count ?? 0).toLocaleString("en-AU")}
          label="Photos and videos"
          hint={stuckCount > 0 ? `${stuckCount.toLocaleString("en-AU")} unfinished` : `${plural(published.count ?? 0, "album")} live`}
          tone={stuckCount > 0 ? "attention" : "plain"}
        />
        <Stat
          value={(joined.count ?? 0).toLocaleString("en-AU")}
          label="Attendees joined"
          hint={event.access_mode === "guest_list" ? `of ${(onList.count ?? 0).toLocaleString("en-AU")} on the list` : "through the event link"}
        />
        <Stat
          value={(findable.count ?? 0).toLocaleString("en-AU")}
          label="Found their photos"
          hint="added a selfie"
          tone={(findable.count ?? 0) > 0 ? "good" : "plain"}
        />
        <Stat
          value={(downloads.count ?? 0).toLocaleString("en-AU")}
          label="Downloads"
          hint="single photos and zips"
          tone={(downloads.count ?? 0) > 0 ? "good" : "plain"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="soft-card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-semibold">Needs you</h2>
              {tasks.length ? <span className="soft-chip">{tasks.length}</span> : <span className="soft-chip soft-chip-muted">All clear</span>}
            </div>
            {tasks.length ? (
              <ul className="m-0 flex list-none flex-col p-0">
                {tasks.map((task, index) => (
                  <li
                    key={task.key}
                    className={`flex flex-wrap items-center gap-3 py-3 ${index > 0 ? "border-t border-[color:var(--kb-line)]" : ""}`}
                  >
                    <span
                      className="h-[7px] w-[7px] flex-none rounded-full"
                      style={{ background: task.urgent ? "#b42318" : "var(--kb-line-strong)" }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">{task.title}</span>
                      <span className="block text-[14px] text-[color:var(--ink-70)]">{task.body}</span>
                    </span>
                    <Link href={task.href} className="btn btn-sm btn-secondary no-underline">
                      {task.cta}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">Nothing waiting on you.</p>
            )}
          </section>

          <section className="soft-card flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold">Albums</h2>
              <Link href={`/admin/${handle}/albums`} className="text-[14px] font-medium">
                All {(albumCount.count ?? 0).toLocaleString("en-AU")}
              </Link>
            </div>
            {stacked.length ? (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {stacked.map((album) => (
                  <Link key={album.id} href={`/e/${handle}/a/${album.id}`} className="flex flex-col gap-2 text-ink no-underline">
                    <span className="soft-tile relative block aspect-[4/3]">
                      {album.coverUrl ? <img src={album.coverUrl} alt="" loading="lazy" /> : null}
                      {album.status !== "published" ? (
                        <span className="absolute left-2 top-2 rounded-[6px] bg-[rgb(22_24_29/0.78)] px-2 py-0.5 text-[14px] font-medium text-white">
                          {album.status === "hidden" ? "Hidden" : "Draft"}
                        </span>
                      ) : null}
                    </span>
                    <span>
                      <span className="block truncate text-[14px] font-medium">{album.title}</span>
                      <span className="block text-[14px] text-[color:var(--ink-70)]">
                        {plural(album.photoCount + album.videoCount, "file")}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">No albums yet. Create one, then add photographers.</p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="soft-card flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold">Share with attendees</h2>
            <div className="flex items-center gap-4">
              <span
                className="block w-[112px] flex-none overflow-hidden rounded-[8px] border border-[color:var(--kb-line)] bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                // Generated server-side from the event link by the qrcode package.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                aria-label="QR code for the event link"
                role="img"
              />
              <span className="min-w-0 break-all text-[14px] text-[color:var(--kb-ink-2)]">{link.replace(/^https?:\/\//, "")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={link} label="Copy link" className="btn btn-sm btn-secondary" />
              <Link href={`/admin/${handle}/share`} className="btn btn-sm btn-secondary no-underline">
                Poster and email
              </Link>
            </div>
          </section>

          <section className="soft-card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold">Activity</h2>
              <Link href={`/admin/${handle}/activity`} className="text-[14px] font-medium">
                Full log
              </Link>
            </div>
            {activity.data?.length ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {activity.data.map((e) => (
                  <li key={e.id} className="flex flex-col">
                    <span className="text-[14px]">
                      <strong className="font-medium">
                        {e.memberships
                          ? personName({
                              displayName: e.memberships.users?.display_name,
                              claimedName: e.memberships.claimed_name,
                              rosterName: e.memberships.roster_name,
                            })
                          : "An organiser"}
                      </strong>{" "}
                      {e.action === "zip" ? "downloaded a zip" : e.action === "download" ? "downloaded" : "viewed"}
                      {e.action === "zip" ? "" : ` ${e.media?.original_filename ?? "a photo"}`}
                    </span>
                    <span className="text-[14px] text-[color:var(--ink-55)]">{formatDateTime(e.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">No views yet. Once attendees open photos, you&apos;ll see it here.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

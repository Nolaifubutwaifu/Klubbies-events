/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { Disclosure } from "@/components/Disclosure";
import { MoreLink, MoreMenu } from "@/components/MoreMenu";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { personName } from "@/lib/auth/display-name";
import { accessHasEnded } from "@/lib/auth/session";
import { isTier, overflowWindow, planName } from "@/lib/billing/plans";
import { canWrite } from "@/lib/billing/status";
import { getPlanUsage } from "@/lib/billing/usage";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { formatDate, formatDateTime, formatEventDates, formatLongDate, plural } from "@/lib/format";
import { listStackedAlbums } from "@/lib/media/album-list";
import { EXPIRE_AFTER_DAYS, STUCK_AFTER_MS } from "@/lib/media/constants";
import { eventLink, eventQrSvg } from "@/lib/share";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { setupState } from "@/lib/events/setup";

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
  const inApp = await isNativeAppRequest();
  const setup = await setupState(event, inApp);
  if (!setup.requiredDone) redirect(`/admin/${handle}/setup`);
  const nextStep = setup.recommended.find((step) => !step.done) ?? null;
  const doneSteps = setup.recommended.filter((step) => step.done).length;

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
    qrSvg,
    toApprove,
  ] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "active"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("event_id", eventId).in("status", ["pending", "active"]),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "published"),
    // What attendees can actually open: finished files.
    supabase.from("media").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "ready"),
    // Attendees' downloads only: the team checking its own gallery isn't
    // proof anyone got their photos.
    supabase
      .from("access_events")
      .select("id, memberships!inner(role)", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("action", ["download", "zip"])
      .neq("memberships.role", "event_admin"),
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
    eventQrSvg(handle),
    // Signed in under a name that doesn't match the list (migration 36).
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "active")
      .not("name_review_at", "is", null),
  ]);

  const drafts = (albumCount.count ?? 0) - (published.count ?? 0);
  const openRemovals = removals.count ?? 0;
  const hasPhotos = (readyItems.count ?? 0) > 0;
  const stuckCount = stuck.count ?? 0;
  const stuckAlbums = [
    ...new Map((stuck.data ?? []).filter((row) => row.album_id).map((row) => [row.album_id!, row.albums?.title ?? "an album"])),
  ];
  const writable = canWrite(event);
  const link = eventLink(handle);
  const closed = accessHasEnded(event);

  const usage = await getPlanUsage(event.id);
  const { windowEnds, windowOpen } = overflowWindow(event);
  const photosFull = Boolean(usage?.photoLimit && usage.unitsUsed >= usage.photoLimit);

  // What needs doing, then the numbers, then the evidence.
  const tasks = [
    windowOpen && windowEnds
      ? {
          key: "overflow",
          title: "The event is over its guest limit",
          body: `Guests can keep joining until ${formatDateTime(windowEnds)}. ${inApp ? "After that, the guests who joined last are paused." : "Upgrade before then to keep them all."}`,
          href: `/admin/${handle}/billing`,
          cta: inApp ? "Status" : "Upgrade",
          urgent: true,
        }
      : null,
    usage && usage.guestsPaused > 0
      ? {
          key: "paused",
          title: `${plural(usage.guestsPaused, "guest")} paused`,
          body: `They joined after the event filled up and can't see photos. ${inApp ? "Removing guests makes room." : "Upgrade to let them in, or remove guests to make room."}`,
          href: `/admin/${handle}/billing`,
          cta: inApp ? "Status" : "Upgrade",
          urgent: true,
        }
      : null,
    photosFull
      ? {
          key: "photos-full",
          title: "Uploads have stopped",
          body: `The event has used all ${usage?.photoLimit?.toLocaleString("en-AU")} of its photos. ${inApp ? "Delete some to make room." : "Upgrade, or delete some to make room."}`,
          href: `/admin/${handle}/billing`,
          cta: inApp ? "Status" : "Upgrade",
          urgent: true,
        }
      : null,
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
    (toApprove.count ?? 0) > 0
      ? {
          key: "approve",
          title: `${plural(toApprove.count ?? 0, "person", "people")} to approve`,
          body: "They signed in under a name that isn't the one on your list. They can't see photos until you approve them.",
          href: `/admin/${handle}/attendees`,
          cta: "Review",
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
          href: stuckAlbums[0] ? `/admin/${handle}/albums/${stuckAlbums[0][0]}` : `/admin/${handle}/albums`,
          cta: "Fix",
          urgent: true,
        }
      : null,
    // Left to Next steps while setup steps remain.
    !nextStep && writable && (photographerLinks.count ?? 0) === 0 && (readyItems.count ?? 0) === 0
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

  const planShort = isTier(event.plan) ? planName(event.plan) : null;

  // Per album: views and downloads by attendees, for the table. Four albums at
  // most, two counts each, in parallel.
  const albumStats = new Map(
    await Promise.all(
      stacked.map(async (album) => {
        const count = (actions: string[]) =>
          supabase
            .from("access_events")
            .select("id, media!inner(album_id)", { count: "exact", head: true })
            .eq("event_id", eventId)
            .eq("media.album_id", album.id)
            .in("action", actions);
        const [views, downloadsHere] = await Promise.all([count(["view"]), count(["download", "zip"])]);
        return [album.id, { views: views.count ?? 0, downloads: downloadsHere.count ?? 0 }] as const;
      }),
    ),
  );

  // The newest finished uploads, for the strip at the foot.
  const { data: latest } = await supabase
    .from("media")
    .select("id, album_id, thumb_path, poster_path, photographer_name, created_at, albums!media_album_id_fkey(title)")
    .eq("event_id", eventId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(12);
  const latestUrls = await signPaths(
    supabase,
    (latest ?? []).map((m) => m.thumb_path ?? m.poster_path ?? "").filter(Boolean),
    SIGNED_URL_TTL.thumb,
  );
  const newest = latest?.[0];

  const joinedCount = usage?.guestsJoined ?? joined.count ?? 0;
  const numbers: { label: string; value: number; of: number | null; caption: string; tone: "brand" | "ok" | null }[] = [
    {
      label: "Photos and videos",
      value: readyItems.count ?? 0,
      of: usage?.photoLimit ?? null,
      caption:
        stuckCount > 0
          ? `${stuckCount.toLocaleString("en-AU")} unfinished`
          : usage?.photoLimit && planShort
            ? `of ${usage.photoLimit.toLocaleString("en-AU")} on ${planShort}`
            : `${plural(published.count ?? 0, "album")} live`,
      tone: "brand",
    },
    {
      label: "Attendees joined",
      value: joinedCount,
      of: usage?.guestLimit ?? null,
      caption:
        event.access_mode === "guest_list"
          ? `of ${(onList.count ?? 0).toLocaleString("en-AU")} on the list`
          : usage?.guestLimit && planShort
            ? `of ${usage.guestLimit.toLocaleString("en-AU")} on ${planShort}`
            : "through the event link",
      tone: "brand",
    },
    { label: "Downloads", value: downloads.count ?? 0, of: null, caption: "Originals and zips", tone: null },
  ];

  const taskIcon = (urgent: boolean) =>
    urgent ? (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 10v4M12 17.2v.1" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l2.5 2.5" />
      </>
    );

  const statusLine = closed
    ? `The gallery closed to attendees on ${formatLongDate(event.access_ends_at)}. You still have full access.`
    : [
        event.access_ends_at ? `Gallery open until ${formatDate(event.access_ends_at)}` : formatEventDates(event.starts_on, event.ends_on),
        event.access_mode === "link" ? "Anyone with the link can join" : "Guest list only",
      ]
        .filter(Boolean)
        .join(" · ");

  // Status, then what needs doing, then the detail. One primary action, in
  // the same corner as on every other organiser screen.
  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]">Overview</h1>
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">{statusLine}</p>
        </div>
        <div className="flex items-center gap-2">
          {writable ? (
            <Link href={`/admin/${handle}/upload`} className="btn btn-primary no-underline">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />
              </svg>
              Upload photos
            </Link>
          ) : null}
          <MoreMenu iconOnly label="More actions">
            <MoreLink href={`/e/${handle}`}>See it as an attendee</MoreLink>
            <MoreLink href={`/admin/${handle}/setup`}>Setup checklist</MoreLink>
            <MoreLink href={`/admin/${handle}/activity`}>Full activity log</MoreLink>
          </MoreMenu>
        </div>
      </div>

      {/* The numbers mean nothing before the first photo, so they wait for it. */}
      {hasPhotos ? (
        <section aria-label="Numbers" className="grid grid-cols-3 overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
          {numbers.map((n, index) => (
            <div key={n.label} className={`flex min-w-0 flex-col gap-1.5 px-3.5 py-4 sm:px-5 ${index > 0 ? "border-l border-[color:var(--kb-sand)]" : ""}`}>
              <span className="truncate text-[14px] text-[color:var(--kb-ink-2)]">
                <span className="sm:hidden">{n.label.split(" ")[0]}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </span>
              <span className="num text-[26px] font-semibold leading-none tracking-[-0.02em] sm:text-[30px]">{n.value.toLocaleString("en-AU")}</span>
              {n.of && n.tone ? (
                <span className="relative mt-0.5 h-1 overflow-hidden rounded-[2px] bg-[color:var(--kb-sand)]" aria-hidden>
                  <span
                    className="absolute inset-y-0 left-0 rounded-[2px]"
                    style={{ width: `${Math.min(100, (n.value / n.of) * 100)}%`, background: n.value / n.of >= 0.8 ? "var(--kb-warn)" : "var(--kb-brand)" }}
                  />
                </span>
              ) : null}
              <span className="text-[14px] leading-snug text-[color:var(--kb-ink-3)]">{n.caption}</span>
            </div>
          ))}
        </section>
      ) : null}

      {nextStep ? (
        <Disclosure card title="Next steps" hint={`${doneSteps} of ${setup.recommended.length} done`} aside={`${doneSteps} of ${setup.recommended.length} done`}>
          <ul className="m-0 flex list-none flex-col p-0">
            {setup.recommended.map((step, index) => (
              <li key={step.key} className={`flex items-center gap-3.5 py-3 ${index > 0 ? "border-t border-[color:var(--kb-sand)]" : ""}`}>
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${step.done ? "bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]" : "border-[1.5px] border-[color:var(--kb-line-strong)]"}`}
                  aria-hidden
                >
                  {step.done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">
                    {step.title}
                    <span className="sr-only">{step.done ? " (done)" : ""}</span>
                  </span>
                  <span className="text-[14px] text-[color:var(--kb-ink-2)]">{step.hint}</span>
                </span>
                {step.done ? null : (
                  <Link href={step.href} className={step.key === nextStep.key ? "btn btn-secondary btn-sm no-underline" : "text-[14px] font-medium"}>
                    {step.cta}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-5">
          <section aria-labelledby="needs" className="overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
            <div className="flex items-center justify-between border-b border-[color:var(--kb-sand)] px-5 py-4">
              <h2 id="needs" className="text-[17px] font-semibold">
                Needs you
              </h2>
              {tasks.length ? (
                <span className="kb-chip bg-[color:var(--kb-warn-tint)] text-[color:var(--kb-warn)]">{plural(tasks.length, "item")}</span>
              ) : (
                <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">All clear</span>
              )}
            </div>
            {tasks.length ? (
              tasks.map((task, index) => (
                <Link
                  key={task.key}
                  href={task.href}
                  className={`flex items-center gap-3.5 px-5 py-4 text-ink no-underline hover:bg-[color:var(--kb-cream)] ${index > 0 ? "border-t border-[color:var(--kb-sand)]" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 flex-none items-center justify-center rounded-[8px] ${task.urgent ? "bg-[color:var(--kb-warn-tint)] text-[color:var(--kb-warn)]" : "bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]"}`}
                    aria-hidden
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {taskIcon(task.urgent)}
                    </svg>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{task.title}</span>
                    <span className="text-[14px] text-[color:var(--kb-ink-2)]">{task.body}</span>
                  </span>
                  <span className="hidden flex-none text-[14px] font-medium text-[color:var(--kb-brand-deep)] sm:inline">{task.cta}</span>
                  <span className="sr-only sm:hidden">{task.cta}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))
            ) : (
              <p className="m-0 px-5 py-4 text-[14px] text-[color:var(--kb-ink-2)]">Nothing waiting on you.</p>
            )}
          </section>

          <section aria-labelledby="alb" className="overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
            <div className="flex items-center justify-between border-b border-[color:var(--kb-sand)] px-5 py-4">
              <h2 id="alb" className="text-[17px] font-semibold">
                Albums
              </h2>
              <Link href={`/admin/${handle}/albums`} className="text-[14px] font-medium">
                All albums
              </Link>
            </div>
            {stacked.length ? (
              <ul className="m-0 list-none p-0">
                {stacked.map((album, index) => {
                  const stats = albumStats.get(album.id);
                  const items = album.photoCount + album.videoCount;
                  return (
                    <li key={album.id} className={index > 0 ? "border-t border-[color:var(--kb-sand)]" : ""}>
                      <Link href={`/admin/${handle}/albums/${album.id}`} className="flex items-center gap-3 px-5 py-3 text-ink no-underline hover:bg-[color:var(--kb-cream)]">
                        <span className="block h-10 w-10 flex-none overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                          {album.coverUrl ? <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
                          <span className="truncate font-medium">{album.title}</span>
                          <span className="num text-[14px] text-[color:var(--kb-ink-3)]">
                            {items ? plural(items, "item") : "No photos yet"}
                            {items ? ` · ${plural(stats?.views ?? 0, "view")} · ${plural(stats?.downloads ?? 0, "download")}` : ""}
                          </span>
                        </span>
                        <AlbumStatus status={album.status} publishAt={album.publishAt} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 px-5 py-4 text-[14px] text-[color:var(--kb-ink-2)]">No albums yet. Create one, then add photographers.</p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <section aria-labelledby="sh" className="overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
            <div className="flex items-center justify-between border-b border-[color:var(--kb-sand)] px-5 py-4">
              <h2 id="sh" className="text-[17px] font-semibold">
                Share with attendees
              </h2>
              <Link href={`/admin/${handle}/share`} className="text-[14px] font-medium">
                Poster and email
              </Link>
            </div>
            <div className="flex items-center gap-4 p-5">
              <span
                className="block w-[88px] flex-none overflow-hidden rounded-[8px] border border-[color:var(--kb-line)] bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                // Generated server-side from the event link by the qrcode package.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                aria-label="QR code for the event link"
                role="img"
              />
              <span className="flex min-w-0 flex-col items-start gap-2">
                <span className="mono break-all text-[14px]">{link.replace(/^https?:\/\//, "")}</span>
                <CopyButton value={link} label="Copy link" className="btn btn-secondary !min-h-[40px]" />
              </span>
            </div>
          </section>

          {hasPhotos ? (
            <section aria-labelledby="act" className="overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
              <div className="flex items-center justify-between border-b border-[color:var(--kb-sand)] px-5 py-4">
                <h2 id="act" className="text-[17px] font-semibold">
                  Recent activity
                </h2>
                <Link href={`/admin/${handle}/activity`} className="text-[14px] font-medium">
                  Full log
                </Link>
              </div>
              {activity.data?.length ? (
                <ul className="m-0 list-none px-5 py-2">
                  {activity.data.map((e) => (
                    <li key={e.id} className="flex gap-3 py-2">
                      <span
                        className="mt-[7px] h-2 w-2 flex-none rounded-full"
                        style={{ background: e.action === "view" ? "var(--kb-line-strong)" : "var(--kb-brand)" }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-[14px]">
                        <strong className="font-semibold">
                          {e.memberships
                            ? personName({
                                displayName: e.memberships.users?.display_name,
                                claimedName: e.memberships.claimed_name,
                                rosterName: e.memberships.roster_name,
                              })
                            : "An organiser"}
                        </strong>{" "}
                        {e.action === "zip" ? "downloaded a zip" : e.action === "download" ? "downloaded" : "viewed"}
                        {e.action === "zip" ? "" : <span className="break-all"> {e.media?.original_filename ?? "a photo"}</span>}
                        <br />
                        <span className="text-[color:var(--kb-ink-3)]">{formatDateTime(e.occurred_at)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 px-5 py-4 text-[14px] text-[color:var(--kb-ink-2)]">No views yet. Once attendees open photos, you&apos;ll see it here.</p>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {latest?.length ? (
        <section aria-labelledby="latest" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="latest" className="text-[17px] font-semibold">
              Latest uploads
            </h2>
            {newest ? (
              <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                {[newest.albums?.title, newest.photographer_name, formatDateTime(newest.created_at)].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-12">
            {latest.map((m) => {
              const url = latestUrls.get(m.thumb_path ?? m.poster_path ?? "");
              return (
                <Link
                  key={m.id}
                  href={m.album_id ? `/e/${handle}/a/${m.album_id}/${m.id}` : `/admin/${handle}/albums`}
                  className="soft-tile block aspect-square !rounded-[4px]"
                  aria-label={`Photo in ${m.albums?.title ?? "an album"}`}
                >
                  {url ? <img src={url} alt="" loading="lazy" /> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function AlbumStatus({ status, publishAt }: { status: string; publishAt: string | null }) {
  if (status === "published") return <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">Published</span>;
  if (publishAt) return <span className="kb-chip bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]">{formatDateTime(publishAt)}</span>;
  if (status === "hidden") return <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Hidden</span>;
  return <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Draft</span>;
}

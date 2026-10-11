/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaceNotice } from "@/components/FaceNotice";
import { EventMark } from "@/components/EventMark";
import { MarkVisited } from "@/components/MarkVisited";
import { PushPrompt } from "@/components/PushPrompt";
import { YourPhotosCard } from "@/components/event/YourPhotosCard";
import { getEventContext } from "@/lib/auth/session";
import { countPhotosOfYou, faceStateFor, listPhotosOfYou } from "@/lib/faces/queries";
import { formatDate, formatEventDates, plural } from "@/lib/format";
import { listStackedAlbums, type StackedAlbum } from "@/lib/media/album-list";
import { SIGNED_URL_TTL, signLogoMarks, signPaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(props: PageProps<"/e/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  return { title: ctx?.event.name ?? "Event" };
}

function countLabel(album: StackedAlbum): string {
  const parts = [
    album.photoCount ? plural(album.photoCount, "photo") : null,
    album.videoCount ? plural(album.videoCount, "video") : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Nothing in here yet";
}

export default async function EventHomePage(props: PageProps<"/e/[handle]">) {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  if (!ctx) notFound();
  const { event } = ctx;

  const supabase = await createClient();
  const [albums, faceState, logos] = await Promise.all([
    listStackedAlbums(supabase, event.id, { includeDrafts: ctx.perms.manage_albums, since: ctx.membership?.last_seen_at ?? null }),
    faceStateFor(supabase, event.id, ctx.userId),
    signLogoMarks(supabase, [event.logo_path]),
  ]);
  const logoUrl = event.logo_path ? (logos.get(event.logo_path) ?? null) : null;

  const enrolled = faceState.enabled && faceState.profile?.status === "ready";
  const [preview, matchCount] = enrolled
    ? await Promise.all([listPhotosOfYou(supabase, event.id, 0), countPhotosOfYou(supabase, event.id)])
    : [null, 0];
  const previewItems = (preview?.groups ?? []).flatMap((group) => group.items).slice(0, 8);

  const published = albums.filter((a) => a.status === "published");
  const drafts = albums.length - published.length;
  const totals = published.reduce((sum, a) => sum + a.photoCount + a.videoCount, 0);
  const dates = formatEventDates(event.starts_on, event.ends_on);
  const needsNotice = faceState.enabled && !ctx.membership?.face_notice_ack_at;
  // The event's picture: the cover of the album it leads with, once published.
  const cover = published.find((album) => album.heroUrl)?.heroUrl ?? null;
  const [credits, selfieUrl] = await Promise.all([photographerNames(supabase, event.id), enrolled ? ownSelfie(event.id, ctx.userId) : null]);

  const summary = [plural(totals, "photo"), plural(published.length, "album")].join(" · ");
  const scheduledCount = albums.filter((album) => album.status !== "published" && album.publishAt).length;

  return (
    <main className="flex flex-1 flex-col pb-20">
      {/* The event's band. On a phone: its cover, then its name on a tint of
          its colour. From 1024px: the name over the cover, which fades into
          the event's own deep tone so a client's loud brand stays calm. */}
      <section aria-labelledby="event-name" className="relative overflow-hidden bg-[color:var(--tone-support,var(--kb-mist))] lg:flex lg:min-h-[400px] lg:items-end lg:bg-[color:var(--kb-ember-deep)]">
        {cover ? (
          <>
            <img src={cover} alt="" className="block h-[200px] w-full object-cover lg:absolute lg:inset-0 lg:h-full" />
            <span
              aria-hidden
              className="absolute inset-0 hidden lg:block"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--kb-ember-deep) 15%, transparent) 0%, color-mix(in srgb, var(--kb-ember-deep) 88%, transparent) 100%)",
              }}
            />
          </>
        ) : null}
        <div className="relative mx-auto flex w-full max-w-[1200px] flex-wrap items-end justify-between gap-6 px-5 pb-11 pt-5 sm:px-10 lg:pb-12 lg:pt-[120px] lg:text-white">
          <div className="flex max-w-[760px] flex-col gap-2 lg:gap-3">
            <div className="flex items-center gap-3">
              {logoUrl ? <EventMark name={event.name} logoUrl={logoUrl} accentColour={event.accent_colour} size={36} /> : null}
              {event.organisation ? (
                <span className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[color:var(--tone-support-ink,var(--kb-ink-2))] lg:text-white">
                  {event.organisation} presents
                </span>
              ) : null}
            </div>
            <h1 id="event-name" className="serif text-balance text-[40px] leading-none lg:text-[72px] lg:leading-[0.98] lg:!text-white">
              {event.name}
            </h1>
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-[#33363d] lg:gap-x-6 lg:text-[16px] lg:text-white">
              {dates ? (
                <span className="flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="lg:hidden">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                  {dates}
                </span>
              ) : null}
              {event.venue ? (
                <span className="flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="lg:hidden">
                    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {event.venue}
                </span>
              ) : null}
            </p>
            {event.description ? <p className="m-0 mt-1 max-w-[62ch] text-[16px] leading-relaxed text-[#33363d] lg:text-white">{event.description}</p> : null}
          </div>
          {totals ? <span className="mono hidden text-[14px] text-white lg:block">{summary}</span> : null}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-5 sm:px-10 lg:gap-14">
        {/* Told first, invited second: the notice has to be acknowledged before
            the selfie invitation appears. It sits over the band's edge on a phone. */}
        {needsNotice ? (
          <div className="relative -mt-6 lg:mt-10">
            <FaceNotice eventId={event.id} meHref={`/e/${handle}/me`} />
          </div>
        ) : faceState.enabled ? (
          <div className="relative -mt-6 lg:mt-10">
            <YourPhotosCard
              handle={handle}
              state={
                !faceState.profile
                  ? "not_enrolled"
                  : faceState.profile.status === "ready"
                    ? matchCount > 0
                      ? "matched"
                      : "no_matches"
                    : faceState.profile.status === "failed"
                      ? "failed"
                      : "looking"
              }
              count={matchCount}
              selfieUrl={selfieUrl}
              albums={[...new Set((preview?.groups ?? []).map((group) => group.albumTitle).filter(Boolean))]}
              previews={previewItems.map((item) => ({ id: item.mediaId, albumId: item.albumId, url: item.thumbUrl }))}
              eventId={event.id}
            />
          </div>
        ) : null}

        {/* One ask at a time: the notification card waits behind the face notice. */}
        {needsNotice ? null : <PushPrompt eventName={event.name} />}

        <section
          className={`flex flex-col gap-4 lg:gap-6 ${needsNotice ? "pointer-events-none select-none opacity-35" : ""}`}
          aria-labelledby="albums-heading"
          inert={needsNotice}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3 lg:border-b lg:border-[color:var(--kb-line)] lg:pb-3.5">
            <h2 id="albums-heading" className="text-[22px] font-semibold tracking-[-0.01em] lg:serif lg:text-[40px] lg:font-normal lg:leading-none">
              {albums.length === 1 ? "Album" : "Albums"}
            </h2>
            <span className="flex items-center gap-3">
              {totals ? (
                <span className="mono text-[14px] text-[color:var(--kb-ink-3)]">
                  {/* The band already says the totals on a wide screen. */}
                  <span className="lg:hidden">{summary}</span>
                  <span className="hidden lg:inline">{published.length.toLocaleString("en-AU")} published</span>
                  {scheduledCount ? ` · ${scheduledCount} scheduled` : ""}
                  {ctx.perms.manage_albums && drafts - scheduledCount > 0 ? ` · ${plural(drafts - scheduledCount, "draft")}` : ""}
                </span>
              ) : null}
              {ctx.perms.manage_albums ? (
                <Link href={`/admin/${handle}/upload`} className="btn btn-secondary btn-sm no-underline">
                  New album
                </Link>
              ) : null}
            </span>
          </div>

          {albums.length === 0 ? (
            <div className="soft-dashed flex flex-col items-start gap-2 p-8">
              <span className="text-[17px] font-semibold">No photos yet</span>
              <span className="max-w-[52ch] text-[15px] text-[color:var(--kb-ink-2)]">
                {ctx.perms.manage_albums
                  ? "Create an album and hand your photographers their upload links. Photos appear here as they land."
                  : "The photographers are still working. Photos appear here as soon as the organiser publishes them, and we'll email you when they do."}
              </span>
              {ctx.perms.manage_albums ? (
                <Link href={`/admin/${handle}/upload`} className="btn btn-primary mt-2 no-underline">
                  Create the first album
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] lg:gap-x-5 lg:gap-y-8">
              {albums.map((album) => {
                const scheduled = album.status !== "published" && album.publishAt;
                return (
                  <Link key={album.id} href={`/e/${handle}/a/${album.id}`} className="group flex flex-col gap-2 text-ink no-underline">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-90" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center rounded-[6px] border-[1.5px] border-dashed border-[color:var(--kb-line-strong)] p-3 text-center text-[14px] text-[color:var(--kb-ink-2)]">
                          {scheduled ? `Publishes on ${formatDate(album.publishAt)}` : "No photos yet"}
                        </span>
                      )}
                      {album.status !== "published" ? (
                        <span className="absolute left-2 top-2 rounded-[6px] bg-[rgb(22_24_29/0.78)] px-2 py-0.5 text-[14px] font-medium text-white">
                          {album.status === "hidden" ? "Hidden" : scheduled ? `Goes live ${formatDate(album.publishAt)}` : "Draft"}
                        </span>
                      ) : album.isNew ? (
                        <span className="absolute left-2 top-2 rounded-[6px] bg-white px-2 py-0.5 text-[14px] font-medium text-ink">New</span>
                      ) : null}
                    </div>
                    <span className="flex flex-col leading-[1.35] lg:flex-row lg:justify-between lg:gap-2">
                      <span className="font-semibold lg:text-[17px]">{album.title}</span>
                      <span className="text-[14px] text-[color:var(--kb-ink-2)] lg:hidden">
                        {[
                          countLabel(album),
                          album.status === "published" && event.ends_on && event.ends_on !== event.starts_on ? formatDate(album.date) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="mono hidden text-[14px] text-[color:var(--kb-ink-3)] lg:inline">
                        {(album.photoCount + album.videoCount).toLocaleString("en-AU")}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {needsNotice ? (
          <p className="text-center text-[14px] text-[color:var(--kb-ink-3)]">
            The albums open once you&apos;ve read this. Being findable is a separate choice.
          </p>
        ) : null}

        {event.access_ends_at || credits.length ? (
          <p className="m-0 border-t border-[color:var(--kb-line)] pt-5 text-center text-[14px] text-[color:var(--kb-ink-3)] lg:text-left">
            {[
              event.access_ends_at ? `Gallery open until ${formatDate(event.access_ends_at)}` : null,
              credits.length ? `Photos by ${listNames(credits)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      {/* Stamps the visit after render, so this page still shows what was new. */}
      <MarkVisited eventId={event.id} />
    </main>
  );
}

/** "Priya Shah", "Priya Shah and Tom Reid", "Priya Shah, Tom Reid and 2 others". */
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

/** Who took the photos attendees can see, for the credit under the albums. */
async function photographerNames(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string): Promise<string[]> {
  const { data } = await supabase
    .from("media")
    .select("photographer_name")
    .eq("event_id", eventId)
    .not("photographer_name", "is", null)
    .limit(2000);
  return [...new Set((data ?? []).map((row) => row.photographer_name?.trim()).filter((name): name is string => Boolean(name)))];
}

/** The viewer's own selfie, signed for them: it is theirs, so the admin client may fetch it. */
async function ownSelfie(eventId: string, userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("member_face_profiles").select("selfie_path").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (!data?.selfie_path) return null;
  return (await signPaths(admin, [data.selfie_path], SIGNED_URL_TTL.display)).get(data.selfie_path) ?? null;
}

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
import { signLogoMarks } from "@/lib/storage";
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
  const meta = [formatEventDates(event.starts_on, event.ends_on), event.venue].filter(Boolean).join(" · ");
  const single = albums.length === 1;
  const needsNotice = faceState.enabled && !ctx.membership?.face_notice_ack_at;

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      {/* The branded band: the event's own colour, mixed into the paper so a
          client's loud brand stays calm, with its logo and serif name. */}
      <header className="flex flex-col gap-3 rounded-[var(--kb-r-card)] bg-[color:var(--tone-support,var(--kb-mist))] px-5 py-7 sm:px-10 sm:py-11">
        <div className="flex items-center gap-3">
          <EventMark name={event.name} logoUrl={logoUrl} accentColour={event.accent_colour} size={40} />
          {event.organisation ? <span className="kb-eyebrow">Hosted by {event.organisation}</span> : null}
        </div>
        <h1 className="serif mt-2 max-w-[24ch] text-balance text-[clamp(40px,6.5vw,72px)]">{event.name}</h1>
        <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-[15px] text-[color:var(--kb-ink-2)]">
          {meta ? <span>{meta}</span> : null}
          {totals ? <span className="text-[color:var(--kb-ink-3)]">{plural(totals, "photo or video", "photos and videos")}</span> : null}
          {ctx.perms.manage_albums && drafts > 0 ? (
            <span className="text-[color:var(--kb-ink-3)]">{plural(drafts, "draft album")} only organisers can see</span>
          ) : null}
        </p>
        {event.description ? (
          <p className="m-0 max-w-[62ch] text-[16px] leading-relaxed text-[color:var(--kb-ink-2)]">{event.description}</p>
        ) : null}
      </header>

      {/* Told first, invited second: the notice has to be acknowledged before
          the selfie invitation appears. */}
      {needsNotice ? (
        <div className="mt-6">
          <FaceNotice eventId={event.id} meHref={`/e/${handle}/me`} />
        </div>
      ) : faceState.enabled ? (
        <div className="mt-6">
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
            previews={previewItems.map((item) => ({ id: item.mediaId, albumId: item.albumId, url: item.thumbUrl }))}
            eventId={event.id}
          />
        </div>
      ) : null}

      {/* One ask at a time: the notification card waits behind the face notice. */}
      {needsNotice ? null : <PushPrompt eventName={event.name} />}

      <section className="mt-10 flex flex-col gap-4" aria-labelledby="albums-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="albums-heading" className="text-[20px] font-semibold">
            {single ? "Album" : "Albums"}
          </h2>
          {ctx.perms.manage_albums ? (
            <Link href={`/admin/${handle}/upload`} className="btn btn-secondary btn-sm no-underline">
              New album
            </Link>
          ) : null}
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
          <div className={single ? "grid grid-cols-1" : "grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"}>
            {albums.map((album) => (
              <Link key={album.id} href={`/e/${handle}/a/${album.id}`} className="group flex flex-col gap-3 text-ink no-underline">
                <div
                  className={`relative w-full overflow-hidden rounded-[var(--kb-r-card)] bg-[color:var(--kb-sand)] ${single ? "aspect-[16/9] sm:aspect-[21/9]" : "aspect-[4/3]"}`}
                >
                  {(single ? (album.heroUrl ?? album.coverUrl) : album.coverUrl) ? (
                    <img
                      src={(single ? (album.heroUrl ?? album.coverUrl) : album.coverUrl) ?? ""}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-90"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[14px] text-[color:var(--kb-ink-3)]">
                      No photos yet
                    </span>
                  )}
                  {album.status !== "published" ? (
                    <span className="absolute left-3 top-3 rounded-[6px] bg-[rgb(22_24_29/0.78)] px-2 py-0.5 text-[14px] font-medium text-white">
                      {album.status === "hidden" ? "Hidden" : album.publishAt ? `Goes live ${formatDate(album.publishAt)}` : "Draft"}
                    </span>
                  ) : album.isNew ? (
                    <span className="absolute left-3 top-3 rounded-[6px] bg-white px-2 py-0.5 text-[14px] font-medium text-ink">New</span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={single ? "serif text-[32px]" : "text-[17px] font-semibold leading-snug"}>{album.title}</span>
                  <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                    {[
                      countLabel(album),
                      // Only worth saying on a multi-day event.
                      album.status === "published" && event.ends_on && event.ends_on !== event.starts_on ? formatDate(album.date) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Stamps the visit after render, so this page still shows what was new. */}
      <MarkVisited eventId={event.id} />
    </main>
  );
}

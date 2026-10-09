/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import { ZipParts } from "@/components/ZipParts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Placeholder } from "@/components/ui";
import { getEventContext } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/format";
import { backfillProgress } from "@/lib/faces/backfill";
import {
  faceStateFor,
  listFaceSuggestions,
  listPhotosOfYou,
  type PhotosOfYouGroup,
  type Suggestion,
} from "@/lib/faces/queries";
import { createClient } from "@/lib/supabase/server";
import { Enrol, TurnOff } from "./Enrol";
import { LookingNow } from "./LookingNow";
import { Suggestions } from "./Suggestions";

export async function generateMetadata(props: PageProps<"/e/[handle]/me">): Promise<Metadata> {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  return { title: ctx ? `Your photos · ${ctx.event.name}` : "Your photos" };
}

export default async function PhotosOfYouPage(props: PageProps<"/e/[handle]/me">) {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const state = await faceStateFor(supabase, ctx.event.id, ctx.userId);
  // Off for this event is a state, not a missing page. The not-found screen
  // told a member following a shared link that they weren't in the event.
  if (!state.enabled) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <div>
            <span className="kb-eyebrow">{ctx.event.name}</span>
            <h1 className="serif mt-2 text-[clamp(36px,5vw,56px)]">Your photos</h1>
          </div>
          <div className="soft-card flex max-w-[56ch] flex-col items-start gap-3 p-6">
            <span className="text-[17px] font-semibold">Face search is off for {ctx.event.name}</span>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
              {ctx.isAdmin
                ? "Turn it on in Settings and every attendee can find the photos they're in. Nobody is findable until they add a selfie."
                : "The organiser hasn't turned it on for this event. Every photo is still in the albums."}
            </p>
            <div className="flex flex-wrap gap-2">
              {ctx.isAdmin ? (
                <Link href={`/admin/${handle}/settings`} className="btn btn-primary no-underline">
                  Open settings
                </Link>
              ) : null}
              <Link href={`/e/${handle}`} className="btn btn-secondary no-underline">
                All photos
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const enrolled = state.profile?.status === "ready";
  const [{ groups, total, hasMore }, suggestions, progress] = await Promise.all([
    enrolled
      ? listPhotosOfYou(supabase, ctx.event.id)
      : Promise.resolve({ groups: [] as PhotosOfYouGroup[], total: 0, hasMore: false }),
    enrolled
      ? listFaceSuggestions(supabase, ctx.event.id)
      : Promise.resolve({ items: [] as Suggestion[], total: 0 }),
    backfillProgress(ctx.event.id),
  ]);

  const stillLooking = state.backfillRunning || progress.remaining > 0;

  return (
    <main className="flex flex-1 flex-col">
      <section>
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-7 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kb-eyebrow">{ctx.event.name}</span>
              <h1 className="serif mt-2 text-[clamp(36px,5vw,56px)]">Your photos</h1>
              <p className="mt-2 max-w-[52ch] text-[16px] text-[color:var(--kb-ink-2)]">Only you see this page.</p>
            </div>
          </div>

          {/* Not enrolled: the pitch and the consent screen. */}
          {!state.profile ? <Enrol eventId={ctx.event.id} backHref={`/e/${handle}`} /> : null}

          {/* The selfie was unusable. Say so rather than leaving them waiting. */}
          {state.profile?.status === "failed" ? (
            <div className="soft-card flex max-w-[56ch] flex-col gap-3 p-5">
              <span className="text-[17px] font-semibold">That photo didn&rsquo;t work</span>
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                {state.profile.failure_reason ?? "We could not find a clear face in it."}
              </p>
              <Enrol eventId={ctx.event.id} />
            </div>
          ) : null}

          {state.profile?.status === "pending" ? (
            <div className="soft-card flex max-w-[56ch] flex-col gap-2 p-5">
              <span className="text-[17px] font-semibold">Looking now</span>
              <LookingNow eventId={ctx.event.id} />
              {/* Say what it is actually waiting on. "A minute" is a lie when
                  an event has just switched on and thousands of photos are
                  still being indexed ahead of the first search. */}
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                We&rsquo;re comparing your selfie against this event&rsquo;s photos.{" "}
                {progress.remaining > 0
                  ? `There are ${progress.remaining.toLocaleString("en-AU")} photos still being read, so this may take a while. Your photos appear here as they are found, so you don't need to wait on this page.`
                  : "This usually takes under a minute."}
              </p>
            </div>
          ) : null}

          {enrolled ? (
            <>
              <Suggestions handle={handle} suggestions={suggestions.items} total={suggestions.total} />

              {total > 0 ? (
                <section className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[18px] font-semibold">
                      {total.toLocaleString("en-AU")} {total === 1 ? "photo" : "photos"} of you in{" "}
                      {groups.length.toLocaleString("en-AU")} {groups.length === 1 ? "album" : "albums"}
                    </h2>
                    <span className="flex flex-wrap items-center gap-3">
                      {stillLooking ? (
                        <span className="text-[14px] text-[color:var(--ink-55)]">
                          Still looking through {progress.remaining.toLocaleString("en-AU")} more
                        </span>
                      ) : null}
                      <ZipParts href={`/api/events/${ctx.event.id}/me/zip`} count={total} className="btn btn-primary no-underline" />
                    </span>
                  </div>

                  {/* Stacked by album, because that is how anyone remembers
                      which night they are looking for. */}
                  {groups.map((group) => (
                    <section key={group.albumId} className="flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/e/${handle}/a/${group.albumId}`}
                          className="text-[16px] font-semibold text-ink no-underline"
                        >
                          {group.albumTitle}
                        </Link>
                        <span className="text-[14px] text-[color:var(--ink-55)]">
                          {group.albumDate ? `${formatLongDate(group.albumDate)} · ` : ""}
                          {group.items.length.toLocaleString("en-AU")} of you
                        </span>
                      </div>
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(104px, 18vw, 168px), 1fr))" }}
                      >
                        {group.items.map((item) => (
                          <Link
                            key={item.matchId}
                            href={`/e/${handle}/a/${group.albumId}/${item.mediaId}?from=me`}
                            className="soft-tile block aspect-square no-underline"
                            aria-label={`Photo of you from ${group.albumTitle}`}
                          >
                            {item.thumbUrl ? (
                              <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <Placeholder seed={item.mediaId} className="h-full w-full" />
                            )}
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}

                  {hasMore ? (
                    <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                      Showing your {total.toLocaleString("en-AU")} most recent. Older ones are in the albums
                      themselves, where each shows how many are of you.
                    </p>
                  ) : null}
                </section>
              ) : stillLooking ? (
                /* Enrolled, backfill still running: silence would read as failure. */
                <div className="soft-dashed flex max-w-[56ch] flex-col items-start gap-2 p-7">
                  <span className="text-[17px] font-semibold">Still looking through this event&rsquo;s photos</span>
                  <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                    {progress.remaining.toLocaleString("en-AU")} of {progress.total.toLocaleString("en-AU")} to go.
                    Photos appear here as we find them.
                  </p>
                </div>
              ) : (
                /* Enrolled, backfill done, nothing found. Say it plainly. */
                <div className="soft-dashed flex max-w-[56ch] flex-col items-start gap-2 p-7">
                  <span className="text-[17px] font-semibold">We didn&rsquo;t find you in anything yet</span>
                  <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                    That happens: dim rooms, crowds and motion blur all hide faces, and we skip anything we are not
                    reasonably sure about. A brighter selfie facing the camera usually helps.
                  </p>
                  <Enrol eventId={ctx.event.id} />
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-[color:var(--kb-line)] pt-5">
                <p className="m-0 max-w-[60ch] text-[14px] leading-normal text-[color:var(--ink-70)]">
                  Face recognition is not reliable. It misses people and it sometimes matches the wrong person. Matches
                  are suggestions, not statements of fact. Tap &ldquo;Not me&rdquo; on anything wrong.
                </p>
                <TurnOff eventId={ctx.event.id} />
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

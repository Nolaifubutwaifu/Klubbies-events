/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import { ZipParts } from "@/components/ZipParts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Placeholder } from "@/components/ui";
import { getEventContext } from "@/lib/auth/session";
import { backfillProgress } from "@/lib/faces/backfill";
import {
  faceStateFor,
  listFaceSuggestions,
  listPhotosOfYou,
  type PhotosOfYouGroup,
  type Suggestion,
} from "@/lib/faces/queries";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Enrol, ReplaceSelfie, TurnOff } from "./Enrol";
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

  // Not enrolled: the selfie screen is the whole page.
  if (!state.profile) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col px-5 pb-16 pt-8 sm:px-10 sm:pt-12">
          <Enrol page eventId={ctx.event.id} backHref={`/e/${handle}`} />
        </div>
      </main>
    );
  }

  const selfieUrl = enrolled ? await ownSelfie(ctx.event.id, ctx.userId) : null;
  const pendingSelfie = state.profile?.status === "pending" ? await ownSelfie(ctx.event.id, ctx.userId) : null;
  const PREVIEW = 9;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 pb-16 pt-7 sm:pt-12">
        <div className="flex flex-col gap-1.5 px-5 sm:px-10">
          <h1 className="serif text-[44px] leading-none">Your photos</h1>
          <p className="flex items-center gap-1.5 text-[15px] text-[color:var(--kb-ink-2)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Only you see this page.
          </p>
        </div>

        {/* The selfie was unusable. Say so rather than leaving them waiting. */}
        {state.profile?.status === "failed" ? (
          <div className="mx-5 flex flex-col gap-3 sm:mx-10">
            <div className="kb-info flex-col">
              <strong>That photo didn&rsquo;t work</strong>
              <span>{state.profile.failure_reason ?? "We could not find a clear face in it."}</span>
            </div>
            <Enrol eventId={ctx.event.id} />
          </div>
        ) : null}

        {state.profile?.status === "pending" ? (
          <div className="mx-5 flex flex-col gap-4 sm:mx-10">
            <section role="status" aria-labelledby="looking-title" className="flex max-w-[640px] flex-col gap-4 rounded-[12px] border border-[color:var(--kb-line)] bg-white p-5">
              <div className="flex items-center gap-3.5">
                <span className="relative block h-12 w-12 flex-none">
                  {pendingSelfie ? <img src={pendingSelfie} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="block h-12 w-12 rounded-full bg-[color:var(--kb-sand)]" />}
                  <span className="absolute -inset-1 animate-pulse rounded-full border-2 border-[color:var(--kb-ember)] motion-reduce:animate-none" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <h2 id="looking-title" className="text-[17px] font-semibold">
                    Looking now
                  </h2>
                  {/* Say what it is actually waiting on. "A minute" is a lie when
                      an event has just switched on and thousands of photos are
                      still being indexed ahead of the first search. */}
                  <span className="text-[14px] text-[color:var(--kb-ink-2)]">
                    {progress.remaining > 0 ? "This event's photos are still being read, so this may take a while." : "This usually takes under a minute."}
                  </span>
                </span>
              </div>
              {progress.total > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[14px]">
                    <span className="text-[color:var(--kb-ink-2)]">Checked</span>
                    <span className="mono">
                      {(progress.total - progress.remaining).toLocaleString("en-AU")} of {progress.total.toLocaleString("en-AU")}
                    </span>
                  </span>
                  <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-[color:var(--kb-sand)]" aria-hidden>
                    <span
                      className="absolute inset-y-0 left-0 rounded-[3px] bg-[color:var(--kb-ember)]"
                      style={{ width: `${Math.round(((progress.total - progress.remaining) / progress.total) * 100)}%` }}
                    />
                  </span>
                </div>
              ) : null}
              <LookingNow eventId={ctx.event.id} />
            </section>
            <div aria-hidden className="grid max-w-[640px] grid-cols-3 gap-[3px]">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="soft-skeleton block aspect-square !rounded-[3px]" />
              ))}
            </div>
            <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
              You can leave this page. We&apos;ll keep looking, and new photos are checked as they&apos;re uploaded.
            </p>
          </div>
        ) : null}

        {enrolled ? (
          <>
            {total > 0 ? (
              <section aria-label="Summary" className="mx-5 flex items-center gap-3.5 rounded-[12px] bg-[color:var(--kb-ink)] p-[18px] text-white sm:mx-10">
                {selfieUrl ? <img src={selfieUrl} alt="" className="h-12 w-12 flex-none rounded-full object-cover" /> : null}
                <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                  <span className="text-[20px] font-semibold">
                    <span className="mono">{total.toLocaleString("en-AU")}</span> {total === 1 ? "photo" : "photos"}
                  </span>
                  <span className="text-[14px] text-[#c4c7cf]">
                    in {groups.length.toLocaleString("en-AU")} {groups.length === 1 ? "album" : "albums"}
                    {stillLooking ? `, still looking through ${progress.remaining.toLocaleString("en-AU")} more` : ""}
                  </span>
                </span>
                <ZipParts href={`/api/events/${ctx.event.id}/me/zip`} count={total} label="All" className="btn btn-light !min-h-[48px] no-underline" />
              </section>
            ) : null}

            <div className="px-5 sm:px-10 empty:hidden">
              <Suggestions handle={handle} suggestions={suggestions.items} total={suggestions.total} />
            </div>

            {total > 0 ? (
              /* Stacked by album, because that is how anyone remembers which
                 night they are looking for. */
              groups.map((group) => (
                <section key={group.albumId} aria-labelledby={`g-${group.albumId}`} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2 px-5 sm:px-10">
                    <h2 id={`g-${group.albumId}`} className="text-[18px] font-semibold">
                      {group.albumTitle}
                    </h2>
                    <span className="mono text-[14px] text-[color:var(--kb-ink-3)]">{group.items.length.toLocaleString("en-AU")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-[3px] px-[3px] sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:gap-1 sm:px-10">
                    {group.items.slice(0, PREVIEW).map((item) => (
                      <Link
                        key={item.matchId}
                        href={`/e/${handle}/a/${group.albumId}/${item.mediaId}?from=me`}
                        className="soft-tile block aspect-square !rounded-[3px] no-underline"
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
                  {group.items.length > PREVIEW ? (
                    <Link href={`/e/${handle}/a/${group.albumId}`} className="px-5 text-[15px] font-medium sm:px-10">
                      See all {group.items.length.toLocaleString("en-AU")} in {group.albumTitle}
                    </Link>
                  ) : null}
                </section>
              ))
            ) : stillLooking ? (
              /* Enrolled, backfill still running: silence would read as failure. */
              <div className="soft-dashed mx-5 flex max-w-[56ch] flex-col items-start gap-2 p-7 sm:mx-10">
                <span className="text-[17px] font-semibold">Still looking through this event&rsquo;s photos</span>
                <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                  {progress.remaining.toLocaleString("en-AU")} of {progress.total.toLocaleString("en-AU")} to go. Photos
                  appear here as we find them.
                </p>
              </div>
            ) : (
              /* Enrolled, backfill done, nothing found. Say it plainly. */
              <div className="mx-5 flex flex-col gap-4 sm:mx-10">
                <div className="soft-dashed flex max-w-[56ch] flex-col items-start gap-2 p-7">
                  <span className="text-[17px] font-semibold">We didn&rsquo;t find you in anything yet</span>
                  <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
                    That happens: dim rooms, crowds and motion blur all hide faces, and we skip anything we are not
                    reasonably sure about. A brighter selfie facing the camera usually helps.
                  </p>
                </div>
                <Enrol eventId={ctx.event.id} />
              </div>
            )}

            {hasMore ? (
              <p className="m-0 px-5 text-[14px] text-[color:var(--ink-70)] sm:px-10">
                Showing your {total.toLocaleString("en-AU")} most recent. Older ones are in the albums themselves, where
                each shows how many are of you.
              </p>
            ) : null}

            <section aria-label="Face search" className="mx-5 mt-2 flex flex-col gap-1 border-t border-[color:var(--kb-line)] pt-5 sm:mx-10">
              <p className="m-0 max-w-[60ch] text-[14px] text-[color:var(--kb-ink-2)]">
                Missing some? Dim rooms and motion blur cause misses. Matches are suggestions, not statements of fact: tap
                &ldquo;Not me&rdquo; on anything wrong.
              </p>
              {total > 0 ? <ReplaceSelfie eventId={ctx.event.id} /> : null}
              <TurnOff eventId={ctx.event.id} />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

/** The viewer's own selfie, signed for them alone. */
async function ownSelfie(eventId: string, userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("member_face_profiles").select("selfie_path").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (!data?.selfie_path) return null;
  return (await signPaths(admin, [data.selfie_path], SIGNED_URL_TTL.display)).get(data.selfie_path) ?? null;
}

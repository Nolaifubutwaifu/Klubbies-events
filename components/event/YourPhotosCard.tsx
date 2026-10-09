/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import Link from "next/link";
import { ZipParts } from "@/components/ZipParts";
import { plural } from "@/lib/format";

type State = "not_enrolled" | "looking" | "matched" | "no_matches" | "failed";

/**
 * The reason most attendees open the gallery at all: their own photos. It
 * sits straight under the event name and changes with where they are.
 */
export function YourPhotosCard({
  handle,
  eventId,
  state,
  count,
  previews,
}: {
  handle: string;
  eventId: string;
  state: State;
  count: number;
  previews: { id: string; albumId: string | null; url: string | null }[];
}) {
  const meHref = `/e/${handle}/me`;

  if (state === "matched") {
    return (
      <section className="soft-card flex flex-col gap-4 p-5 sm:p-6" aria-label="Your photos">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="kb-eyebrow">Your photos</span>
            <h2 className="serif mt-1 text-[34px]">{plural(count, "photo")} of you</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <ZipParts href={`/api/events/${eventId}/me/zip`} count={count} />
            <Link href={meHref} className="btn btn-primary no-underline">
              See all
            </Link>
          </div>
        </div>
        {/* Fixed-size tiles rather than a stretched grid, so two photos look
            like two photos and not like a page that failed to load. */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {previews.map((item) => (
            <Link
              key={item.id}
              href={item.albumId ? `/e/${handle}/a/${item.albumId}/${item.id}?from=me` : meHref}
              className="soft-tile aspect-[4/5] w-[112px] flex-none sm:w-[148px]"
              aria-label="Open photo"
            >
              {item.url ? <img src={item.url} alt="" loading="lazy" /> : null}
            </Link>
          ))}
          {count > previews.length ? (
            <Link
              href={meHref}
              className="flex aspect-[4/5] w-[112px] flex-none flex-col items-center justify-center gap-1 rounded-[6px] bg-[color:var(--kb-mist)] text-[15px] font-medium text-ink no-underline sm:w-[148px]"
            >
              +{(count - previews.length).toLocaleString("en-AU")}
              <span className="text-[14px] font-normal text-[color:var(--kb-ink-3)]">more</span>
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  const copy: Record<Exclude<State, "matched">, { title: string; body: string; cta: string }> = {
    not_enrolled: {
      title: "Find the photos you're in",
      body: "Add a selfie and we'll find every photo you're in. Only you see them.",
      cta: "Find my photos",
    },
    looking: {
      title: "Looking for you now",
      body: "We're checking the event's photos against your selfie. This usually takes under a minute.",
      cta: "See progress",
    },
    no_matches: {
      title: "No photos of you yet",
      body: "Nothing matched so far. New photos are checked as they're uploaded, so look again after the next album goes up.",
      cta: "Check your selfie",
    },
    failed: {
      title: "That selfie didn't work",
      body: "We couldn't find a clear face in it. Try again facing the camera in good light.",
      cta: "Try again",
    },
  };
  const c = copy[state];

  return (
    <section className="soft-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6" aria-label="Your photos">
      <span
        className="flex h-12 w-12 flex-none items-center justify-center rounded-[10px] bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember)]"
        aria-hidden
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="10.5" r="2.6" />
          <path d="M7.8 16.5c.8-1.8 2.3-2.7 4.2-2.7s3.4.9 4.2 2.7" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[18px] font-semibold">
          {state === "looking" ? <span className="kb-pulse mr-2 inline-block align-middle" aria-hidden /> : null}
          {c.title}
        </h2>
        <p className="m-0 mt-1 max-w-[62ch] text-[15px] text-[color:var(--kb-ink-2)]">{c.body}</p>
      </div>
      <Link href={meHref} className={`btn ${state === "not_enrolled" ? "btn-primary" : "btn-secondary"} no-underline`}>
        {c.cta}
      </Link>
    </section>
  );
}

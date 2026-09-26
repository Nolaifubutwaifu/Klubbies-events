/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import Link from "next/link";
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
  zipParts,
}: {
  handle: string;
  eventId: string;
  state: State;
  count: number;
  previews: { id: string; albumId: string | null; url: string | null }[];
  zipParts: number;
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
            <a href={`/api/events/${eventId}/me/zip`} className="btn btn-secondary no-underline" download>
              {zipParts > 1 ? "Download (part 1)" : "Download all"}
            </a>
            <Link href={meHref} className="btn btn-primary no-underline">
              See all
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
          {previews.map((item) => (
            <Link
              key={item.id}
              href={item.albumId ? `/e/${handle}/a/${item.albumId}/${item.id}` : meHref}
              className="soft-tile aspect-square"
              aria-label="Open photo"
            >
              {item.url ? <img src={item.url} alt="" loading="lazy" /> : null}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  const copy: Record<Exclude<State, "matched">, { title: string; body: string; cta: string }> = {
    not_enrolled: {
      title: "Find the photos you're in",
      body: "Take a selfie and we'll show you every photo you appear in. Only you see the results, it's optional, and you can delete your face data any time.",
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

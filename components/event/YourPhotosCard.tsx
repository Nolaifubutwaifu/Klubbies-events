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
  albums = [],
  selfieUrl = null,
  previews,
}: {
  handle: string;
  eventId: string;
  state: State;
  count: number;
  /** Album names the matches came from, for "Across Keynote and Awards". */
  albums?: string[];
  /** Their own selfie, signed for them alone. */
  selfieUrl?: string | null;
  previews: { id: string; albumId: string | null; url: string | null }[];
}) {
  const meHref = `/e/${handle}/me`;

  if (state === "matched") {
    const across =
      albums.length === 0 ? "" : albums.length === 1 ? `In ${albums[0]}` : `Across ${albums.slice(0, -1).join(", ")} and ${albums[albums.length - 1]}`;
    // Four tiles on a phone, six from 1024px; the last one says how many more.
    const shown = previews.slice(0, 6);
    const more = count - Math.min(previews.length, 4);
    return (
      <section
        className="flex flex-col gap-3.5 rounded-[12px] border border-[color:var(--kb-line)] bg-white p-[18px] shadow-[0_10px_28px_-12px_rgb(22_24_29/0.2)] lg:flex-row lg:flex-wrap lg:items-center lg:gap-7 lg:rounded-[14px] lg:p-7 lg:shadow-none"
        aria-labelledby="your-photos-title"
      >
        <div className="flex items-center gap-3 lg:flex-[1_1_300px] lg:gap-4">
          {selfieUrl ? (
            <img src={selfieUrl} alt="" className="h-11 w-11 flex-none rounded-full object-cover lg:h-14 lg:w-14" />
          ) : (
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember)] lg:h-14 lg:w-14" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </span>
          )}
          <span className="flex flex-col leading-[1.3]">
            <h2 id="your-photos-title" className="text-[17px] font-semibold lg:text-[24px] lg:tracking-[-0.01em]">
              {plural(count, "photo")} of you
            </h2>
            <span className="text-[14px] text-[color:var(--kb-ink-2)] lg:text-[16px]">
              {across}
              <span className="hidden lg:inline">{across ? ". " : ""}Only you see these.</span>
            </span>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 lg:flex-[2_1_420px] lg:grid-cols-6">
          {shown.map((item, index) => {
            const overflowAt = index === 3 && more > 0;
            return (
              <Link
                key={item.id}
                href={overflowAt ? meHref : item.albumId ? `/e/${handle}/a/${item.albumId}/${item.id}?from=me` : meHref}
                className={`soft-tile relative aspect-square ${index >= 4 ? "hidden lg:block" : ""}`}
                aria-label={overflowAt ? `See all ${count} photos of you` : "Open photo"}
              >
                {item.url ? <img src={item.url} alt="" loading="lazy" /> : null}
                {overflowAt ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-[rgb(22_24_29/0.62)] text-[15px] font-semibold text-white lg:hidden">
                    +{more.toLocaleString("en-AU")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-[1_1_220px] lg:flex-wrap lg:justify-end">
          <Link href={meHref} className="btn btn-secondary !min-h-[48px] no-underline">
            See all
          </Link>
          <ZipParts href={`/api/events/${eventId}/me/zip`} count={count} className="btn btn-primary !min-h-[48px] no-underline" />
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
    <section
      className="flex flex-col gap-4 rounded-[12px] border border-[color:var(--kb-line)] bg-white p-5 shadow-[0_10px_28px_-12px_rgb(22_24_29/0.2)] sm:flex-row sm:items-center sm:p-6 lg:rounded-[14px] lg:shadow-none"
      aria-label="Your photos"
    >
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

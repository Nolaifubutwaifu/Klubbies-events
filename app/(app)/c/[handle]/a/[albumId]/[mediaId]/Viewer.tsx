"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { decideFaceMatchAction } from "@/app/(app)/face-actions";
import { requestRemovalAction } from "@/app/(app)/removal-actions";
import { toggleFavouriteAction } from "@/app/(app)/c/[handle]/actions";

type Current = {
  id: string;
  kind: "photo" | "video";
  displayUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  filename: string;
  width: number | null;
  height: number | null;
  duration: string;
  takenAt: string;
};

const SWIPED_KEY = "kb-swiped";
const subscribeNever = () => () => {};
/** Whether this browser has swiped in the viewer before, so the hint can stop. */
function hasSwiped(): boolean {
  try {
    return localStorage.getItem(SWIPED_KEY) === "1";
  } catch {
    return true; // storage blocked: better no hint than one that never leaves
  }
}

/** Sheets rise from the bottom on a phone; on a wide screen a full-width
    sheet read as a phone layout stretched, so they become a centred card. */
const SHEET =
  "absolute inset-x-0 bottom-0 z-10 rounded-t-[26px] bg-[color:var(--kb-cream)] shadow-[0_-18px_40px_rgba(0,0,0,0.45)] sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[480px] sm:max-w-[calc(100%-48px)] sm:-translate-x-1/2 sm:rounded-[26px]";

/** A bottom-bar action: favourite, download, and More for everything else. */
function Action({
  label,
  onClick,
  href,
  active = false,
  quiet = false,
  filled = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  quiet?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}) {
  const colour = active ? "var(--kb-ember-on-dark)" : quiet ? "rgba(255,255,255,0.9)" : "#ffffff";
  const inner = (
    <>
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill={filled ? colour : "none"}
        stroke={colour}
        strokeWidth={filled ? 1.6 : 2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
      {label}
    </>
  );
  const className =
    "flex min-h-[52px] flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent text-[14px] font-bold no-underline";
  return href ? (
    <a href={href} className={className} style={{ color: colour }}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className} style={{ color: colour }}>
      {inner}
    </button>
  );
}

export function Viewer({
  albumHref,
  albumTitle,
  itemHrefBase,
  current,
  details,
  prevId,
  nextId,
  position,
  total,
  strip,
  canDownload,
  favourited,
  canAskRemoval,
  alreadyAsked,
  faceMatchId,
}: {
  albumHref: string;
  albumTitle: string;
  itemHrefBase: string;
  current: Current;
  details: { label: string; value: string }[];
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  strip: { id: string; thumbUrl: string | null; kind: string }[];
  canDownload: boolean;
  favourited: boolean;
  canAskRemoval: boolean;
  alreadyAsked: boolean;
  /** Set when face recognition has matched the viewer to this photo. */
  faceMatchId: string | null;
}) {
  const router = useRouter();
  const touchX = useRef<number | null>(null);
  const [saved, setSaved] = useState(favourited);
  const [sheet, setSheet] = useState<"none" | "removal" | "more">("none");
  const swiped = useSyncExternalStore(subscribeNever, hasSwiped, () => true);
  const stripRef = useRef<HTMLDivElement>(null);
  const [asked, setAsked] = useState(alreadyAsked);
  const [matched, setMatched] = useState(faceMatchId);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const prevHref = prevId ? `${itemHrefBase}/${prevId}` : null;
  const nextHref = nextId ? `${itemHrefBase}/${nextId}` : null;

  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [router, prevHref, nextHref]);

  // Keep the current thumbnail in view as you move through the night.
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape" && sheet !== "none") return setSheet("none");
      if (e.key === "ArrowLeft" && prevHref) router.replace(prevHref, { scroll: false });
      if (e.key === "ArrowRight" && nextHref) router.replace(nextHref, { scroll: false });
      if (e.key === "Escape") router.push(albumHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref, albumHref, sheet]);

  const onTouchEnd = (x: number) => {
    if (touchX.current === null) return;
    const dx = x - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    try {
      localStorage.setItem(SWIPED_KEY, "1");
    } catch {
      // Private mode: the hint just fades on its own.
    }
    if (dx > 0 && prevHref) router.replace(prevHref, { scroll: false });
    if (dx < 0 && nextHref) router.replace(nextHref, { scroll: false });
  };

  const round =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-[rgba(20,16,15,0.5)] text-white no-underline backdrop-blur-sm transition-colors hover:bg-[rgba(20,16,15,0.75)]";

  return (
    // The one screen that leaves the cream behind: a photo is easier to read
    // against near-black, and nothing else on this page competes with it.
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-[#14100f]">
      <div className="flex flex-none items-center gap-3 px-3.5 pb-2.5 pt-3.5 sm:px-6">
        <Link
          href={albumHref}
          aria-label="Close photo"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/[0.14] text-white no-underline"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[14px] font-bold text-white">{albumTitle}</div>
          <div className="text-[14px] text-white/[0.68]">
            {position.toLocaleString("en-AU")} of {total.toLocaleString("en-AU")}
            {current.takenAt ? ` · ${current.takenAt}` : ""}
          </div>
        </div>
        {/* Keeps the title centred; More lives in the bottom bar. */}
        <span className="h-11 w-11 flex-none" aria-hidden />
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
      >
        {current.kind === "video" && current.videoUrl ? (
          <video
            key={current.id}
            src={current.videoUrl}
            poster={current.posterUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="max-h-full w-full max-w-[1200px] bg-black"
          />
        ) : current.displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img
            key={current.id}
            src={current.displayUrl}
            alt={`${current.kind === "video" ? "Video" : "Photo"} ${position} of ${total} in ${albumTitle}`}
            className="max-h-full w-auto max-w-full object-contain"
            width={current.width ?? undefined}
            height={current.height ?? undefined}
          />
        ) : (
          <div className="text-white/70">This item can&apos;t be previewed.</div>
        )}
        {prevHref ? (
          <Link href={prevHref} replace scroll={false} className={`${round} left-2.5`} aria-label="Previous photo">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M14 6l-6 6 6 6" />
            </svg>
          </Link>
        ) : null}
        {nextHref ? (
          <Link href={nextHref} replace scroll={false} className={`${round} right-2.5`} aria-label="Next photo">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M10 6l6 6-6 6" />
            </svg>
          </Link>
        ) : null}
        {nextHref && !swiped ? (
          // Until the first swipe, and it fades after a few seconds anyway:
          // a caption sitting on every photo was in the way of the photo.
          <span className="soft-hint-fade pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[rgba(20,16,15,0.55)] px-3 py-1 text-[14px] text-white/80 sm:hidden">
            Swipe for the next one
          </span>
        ) : null}
      </div>

      {/* Filmstrip: where you are in the night, without leaving the photo. */}
      {/* Centred under the photo, scrolling only when the night is long. */}
      <div ref={stripRef} className="mx-auto flex max-w-full flex-none gap-1 overflow-x-auto px-3 pt-2.5">
        {strip.map((item, i) => {
          const here = item.id === current.id;
          const at = position + i - strip.findIndex((s) => s.id === current.id);
          return (
            <Link
              key={item.id}
              href={`${itemHrefBase}/${item.id}`}
              replace
              scroll={false}
              aria-current={here ? "true" : undefined}
              aria-label={`${item.kind === "video" ? "Video" : "Photo"} ${at} of ${total}`}
              className="block h-[46px] w-[46px] flex-none overflow-hidden rounded-[9px] bg-white/10"
              style={here ? { border: "2px solid var(--kb-ember-on-dark)" } : { opacity: 0.5 }}
            >
              {item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-none px-2 pb-6 pt-3">
        <Action
          label={saved ? "Favourited" : "Favourite"}
          active={saved}
          filled={saved}
          onClick={() => {
            const next = !saved;
            setSaved(next);
            startTransition(async () => setSaved((await toggleFavouriteAction(current.id)).favourited));
          }}
        >
          <path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />
        </Action>
        {canDownload ? (
          <Action label="Download" href={`/api/media/${current.id}/download`}>
            <path d="M12 4v11M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </Action>
        ) : null}
        <Action label="More" quiet onClick={() => setSheet(sheet === "more" ? "none" : "more")}>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </Action>
      </div>

      {message ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-[104px] left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[14px] font-bold text-ink shadow-lg"
        >
          {message}
        </div>
      ) : null}

      {sheet === "more" ? (
        <div className={`${SHEET} p-5 pb-6`}>
          <span className="mx-auto mb-3.5 block h-1 w-[42px] rounded-full bg-[color:var(--kb-line-strong)] sm:hidden" />
          {/* Getting a face match wrong has to be one tap to correct,
              wherever you are when you notice. */}
          <div className="mb-4 flex flex-col">
            <button
              type="button"
              className="kb-menu-item !min-h-[52px] !text-[16px]"
              onClick={async () => {
                setSheet("none");
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setMessage("Link copied. Only club members can open it.");
                } catch {
                  setMessage("Couldn't copy the link.");
                }
              }}
            >
              Copy link
            </button>
              {matched ? (
                <button
                  type="button"
                  className="kb-menu-item !min-h-[52px] !text-[16px]"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await decideFaceMatchAction(matched, "reject");
                      setMatched(null);
                      setSheet("none");
                      setMessage(res.error ?? "Thanks. We won't suggest this one again.");
                    })
                  }
                >
                  This isn&rsquo;t me
                </button>
              ) : null}
              {canAskRemoval ? (
                <button type="button" className="kb-menu-item !min-h-[52px] !text-[16px]" data-danger="true" onClick={() => setSheet("removal")}>
                  {asked ? "Removal requested" : "Ask for it to come down"}
                </button>
              ) : null}
          </div>
          <h2 className="soft-display text-[19px]">About this one</h2>
          <dl className="m-0 mt-3 grid gap-x-5 gap-y-2.5" style={{ gridTemplateColumns: "auto 1fr" }}>
            {details.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-[15px] text-[color:var(--kb-ink-2)]">{d.label}</dt>
                <dd className="m-0 text-[15px] font-semibold">{d.value}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 mt-3 text-[15px] text-[color:var(--kb-ink-2)]">
            Only people on the club member list can open this. Views and downloads are logged.
          </p>
          <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setSheet("none")}>
            Close
          </button>
        </div>
      ) : null}

      {sheet === "removal" ? (
        <div className={`${SHEET} px-5 pb-6 pt-4.5`}>
          <span className="mx-auto mb-3.5 block h-1 w-[42px] rounded-full bg-[color-mix(in_srgb,var(--color-text)_18%,transparent)]" />
          <h2 className="soft-display text-[21px]">{asked ? "Already on its way down." : "Take this one down?"}</h2>
          <p className="mt-1.5 text-[15px] text-[color:var(--kb-ink-2)]">
            {asked
              ? "It's hidden from the album. Your media officer confirms it within seven days, and if they don't, it deletes itself."
              : "It hides from the album straight away. Your media officer gets a note and confirms it — no reason needed."}
          </p>
          <div className="mt-4 flex gap-2.5">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setSheet("none")}>
              {asked ? "Close" : "Not now"}
            </button>
            {asked ? null : (
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await requestRemovalAction(current.id);
                    setMessage(res.error ?? res.message ?? "");
                    if (res.ok) {
                      setAsked(true);
                      setSheet("none");
                    }
                  })
                }
              >
                {pending ? "Hiding…" : "Hide it now"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

import Image from "next/image";
import type { ReactNode } from "react";
import type { Feature } from "@/lib/copy/site";

/*
 * The drawn product pieces shared by the public pages. The product is shown as
 * drawn interface, filled with Klubbies' own marketing photos
 * (public/marketing), never with anything from a real event's private gallery.
 */

const ICONS: Record<Feature["icon"], ReactNode> = {
  search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />,
  face: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="10.5" r="2.6" />
      <path d="M7.8 16.5c.8-1.8 2.3-2.7 4.2-2.7s3.4.9 4.2 2.7" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.4 12 20 12 20Z" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />,
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </>
  ),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  camera: (
    <>
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
    </>
  ),
  brand: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />,
};

export function FeatureIcon({ icon }: { icon: Feature["icon"] }) {
  return (
    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[12px] bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]" aria-hidden>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
      </svg>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   October 2026 redesign pieces. Drawn interface again, with the example
   event's teal standing in for an event colour.
   --------------------------------------------------------------------------- */

const EVENT_TEAL = "#0e6e66";

/**
 * A marketing photo by name (public/marketing). Decorative unless it gets alt
 * text; give it some where the photo stands on its own, for image search.
 */
export function Photo({ name, alt, className = "", sizes = "160px" }: { name: string; alt?: string; className?: string; sizes?: string }) {
  return (
    <span className={`relative block overflow-hidden bg-[color:var(--kb-mist)] ${className}`} aria-hidden={alt ? undefined : true}>
      <Image src={`/marketing/${name}.webp`} alt={alt ?? ""} fill sizes={sizes} className="object-cover" />
    </span>
  );
}

export function Tick({ size = 18, className = "", color = "var(--kb-ok)" }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`flex-none ${className}`}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

/** The hero picture: the attendee's Your photos screen on a phone, on a night panel with two notes. */
export function HeroShowcase() {
  // Every tile is a photo the sample attendee (mustard jacket, selfie.webp) is in.
  // sq-6, sq-7 and sq-8 are other people, so they stay out of a grid that says they are his.
  const grid = ["sq-5", "sq-4", "sq-9", "sq-10", "sq-1", "cover-awards", "sq-2", "sq-3", "sq-11"];
  return (
    <div
      role="img"
      aria-label="An attendee's event photo gallery on a phone, showing the photos face search found for them"
      className="relative flex h-[520px] items-center justify-center overflow-hidden rounded-[20px] bg-[color:var(--kb-night)] sm:h-[620px]"
    >
      <span
        aria-hidden
        className="absolute inset-0 [background-image:linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <div className="relative h-[480px] w-[250px] rounded-[40px] bg-[#05070d] p-[9px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)] sm:h-[560px] sm:w-[290px]">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] bg-white">
          <div className="flex flex-col gap-1 px-[18px] pb-[18px] pt-[30px] text-white" style={{ background: EVENT_TEAL }}>
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#cfede9]">Brisbane Product Summit</span>
            <span className="serif text-[30px] leading-[1.05]">Your photos</span>
          </div>
          <div className="flex items-center justify-between px-3.5 pb-2.5 pt-3.5">
            <span className="text-[14px] font-semibold">23 photos of you</span>
            <span className="text-[13px] font-semibold" style={{ color: EVENT_TEAL }}>
              Download all
            </span>
          </div>
          <div className="grid grid-cols-3 gap-[3px] px-3.5">
            {grid.map((name) => (
              <Photo key={name} name={name} className="aspect-square rounded-[4px]" sizes="90px" />
            ))}
          </div>
          <div className="mt-auto grid grid-cols-4 border-t border-[color:var(--kb-line)] px-1.5 pb-4 pt-2.5 text-center text-[11px] text-[color:var(--kb-ink-3)]">
            <span>Photos</span>
            <span className="font-semibold" style={{ color: EVENT_TEAL }}>
              Your photos
            </span>
            <span>Saved</span>
            <span>You</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-14 left-7 hidden items-center gap-3 rounded-[12px] bg-white px-4 py-3.5 shadow-[0_18px_44px_-14px_rgb(0_0_0/0.45)] sm:flex">
        <Photo name="selfie" className="h-11 w-11 rounded-full" sizes="44px" />
        <span className="flex flex-col leading-[1.35]">
          <span className="text-[15px] font-semibold">Found you in 23 photos</span>
          <span className="text-[14px] text-[color:var(--kb-ink-2)]">Keynote, Networking, Awards</span>
        </span>
      </div>
      <div className="absolute right-7 top-14 hidden min-w-[200px] flex-col gap-1.5 rounded-[12px] bg-white px-4 py-3.5 shadow-[0_18px_44px_-14px_rgb(0_0_0/0.45)] sm:flex">
        <span className="text-[14px] text-[color:var(--kb-ink-2)]">Saved to your phone</span>
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <Tick />
          Original quality
        </span>
      </div>
    </div>
  );
}

function MiniCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-3 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-4 shadow-[0_10px_28px_-12px_rgb(22_24_29/0.2)]">
      {children}
    </div>
  );
}

function UploadRow({ file, status, progress }: { file: string; status: string; progress: number }) {
  const done = progress >= 100;
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[13px]">
        <span className="mono">{file}</span>
        <span className={done ? "font-semibold text-[color:var(--kb-ok)]" : "text-[color:var(--kb-ink-2)]"}>{status}</span>
      </span>
      <span className="relative h-1 overflow-hidden rounded-[2px] bg-[color:var(--kb-line)]">
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: `${progress}%`, background: done ? "var(--kb-ok)" : "var(--kb-brand)" }}
        />
      </span>
    </span>
  );
}

const QR_PATH =
  "M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2zM8 0h1v2H8zM10 1h2v1h-2zM9 3h2v2H9zM12 4h1v3h-1zM8 6h2v2H8zM0 8h2v1H0zM3 8h3v2H3zM7 9h3v1H7zM11 8h3v2h-3zM15 8h2v3h-2zM18 8h3v1h-3zM1 11h2v2H1zM5 11h3v1H5zM9 11h2v3H9zM12 12h3v1h-3zM17 12h2v2h-2zM8 14h1v3H8zM10 15h3v1h-3zM14 14h2v2h-2zM17 16h4v1h-4zM11 17h2v4h-2zM14 18h3v2h-3zM19 18h2v3h-2zM8 19h2v2H8z";

/** A small drawn QR code. Decoration: it does not scan. */
export function DrawnQr({ size = 112 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden>
      <rect width="21" height="21" fill="#fff" />
      <path fill="#16181d" d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" />
      <path fill="#fff" d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" />
      <path fill="#16181d" d={QR_PATH} />
    </svg>
  );
}

/** The picture above each of the home page's three steps. */
export function StepVisual({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div aria-hidden className="flex h-[220px] items-center justify-center gap-4 bg-[color:var(--kb-sand)] p-7">
      {step === 0 ? (
        <MiniCard>
          <span className="text-[13px] text-[color:var(--kb-ink-3)]">Event name</span>
          <span className="-mt-1.5 rounded-[6px] border border-[color:var(--kb-line-strong)] px-2.5 py-1.5 text-[15px] font-semibold">
            Brisbane Product Summit 2026
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[22px] w-[22px] rounded-full shadow-[0_0_0_2px_#fff,0_0_0_4px_#0e6e66]" style={{ background: EVENT_TEAL }} />
            <span className="h-[22px] w-[22px] rounded-full bg-[#2b4acb]" />
            <span className="h-[22px] w-[22px] rounded-full bg-[#9a3412]" />
            <span className="h-[22px] w-[22px] rounded-full bg-[#16181d]" />
          </span>
          <span className="flex items-center gap-2 text-[14px]">
            <span className="h-4 w-4 rounded-full border-[5px] border-[color:var(--kb-brand)]" />
            Anyone with the link
          </span>
        </MiniCard>
      ) : step === 1 ? (
        <MiniCard>
          <span className="text-[13px] text-[color:var(--kb-ink-3)]">Uploading to Keynote as Priya Shah</span>
          <UploadRow file="DSC_2041.jpg" status="Done" progress={100} />
          <UploadRow file="DSC_2042.jpg" status="64%" progress={64} />
          <UploadRow file="DSC_2043.jpg" status="Waiting" progress={0} />
        </MiniCard>
      ) : (
        <>
          <div className="rounded-[10px] border border-[color:var(--kb-line)] bg-white p-3.5 shadow-[0_10px_28px_-12px_rgb(22_24_29/0.2)]">
            <DrawnQr />
          </div>
          <div className="flex max-w-[110px] flex-col gap-2">
            <span className="text-[14px] font-semibold leading-[1.3]">Scan to get your photos</span>
            <Photo name="selfie" className="h-[52px] w-[52px] rounded-full shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--kb-brand)]" sizes="52px" />
          </div>
        </>
      )}
    </div>
  );
}

/** Face search, drawn: six photos, three of them you. */
export function FaceMatchVisual() {
  const photos: [string, boolean][] = [
    ["sq-6", false],
    ["sq-5", true],
    ["sq-7", false],
    ["sq-4", true],
    ["sq-8", false],
    ["sq-9", true],
  ];
  return (
    <div aria-hidden className="relative mb-9">
      <div className="grid grid-cols-3 gap-1">
        {photos.map(([name, match]) => (
          <Photo
            key={name}
            name={name}
            sizes="(max-width: 768px) 30vw, 180px"
            className={`aspect-square rounded-[6px] ${match ? "shadow-[0_0_0_3px_var(--kb-brand)]" : "opacity-45"}`}
          />
        ))}
      </div>
      <div className="absolute -bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-[color:var(--kb-ink)] py-2 pl-2 pr-5 text-white shadow-[0_18px_44px_-14px_rgb(22_24_29/0.5)]">
        <Photo name="selfie" className="h-10 w-10 rounded-full" sizes="40px" />
        <span className="text-[15px] font-semibold">3 of 6 are you</span>
      </div>
    </div>
  );
}

/** A full-bleed row of six photos, under the closing call to action. */
export function PhotoStrip() {
  return (
    <div aria-hidden className="mt-20 grid grid-cols-3 gap-1 sm:grid-cols-6">
      {["cover-awards", "sq-4", "sq-7", "sq-6", "sq-8", "sq-9"].map((name) => (
        <Photo key={name} name={name} className="h-[160px] sm:h-[240px]" sizes="(max-width: 640px) 33vw, 17vw" />
      ))}
    </div>
  );
}

/** The closing call to action on night: two buttons and three ticks. */
export function NightCta({
  title,
  lead,
  points,
  secondary,
}: {
  title: string;
  lead: string;
  points: string[];
  secondary: { href: string; label: string };
}) {
  return (
    <section className="kb-section !pt-0">
      <div className="kb-wrap">
        <div className="kb-night-band flex flex-wrap items-center justify-between gap-12 px-7 py-12 sm:px-14 sm:py-16">
          <div className="flex flex-[1_1_420px] flex-col gap-[18px]">
            <h2 className="kb-h2 !leading-[1.02]">{title}</h2>
            <p className="m-0 max-w-[48ch] text-[18px] text-[color:var(--kb-night-ink)]">{lead}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a href="/start" className="btn btn-light btn-lg no-underline">
                Create an event
              </a>
              <a href={secondary.href} className="btn btn-ghost-dark btn-lg no-underline">
                {secondary.label}
              </a>
            </div>
          </div>
          <ul className="m-0 flex flex-[1_1_320px] list-none flex-col gap-3.5 p-0 text-[16px] text-[#e6e9f2]">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <Tick size={20} color="#b3c1f6" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The share kit, drawn: a tilted A4 poster and the announcement email. */
export function ShareKitVisual() {
  return (
    <div
      role="img"
      aria-label="A QR code poster and announcement email that send attendees to the event's photo gallery"
      className="relative h-[460px] min-w-0 overflow-hidden rounded-[20px] bg-[color:var(--kb-sand)] sm:h-[520px]"
    >
      <div className="absolute left-6 top-8 flex h-[410px] w-[290px] -rotate-3 flex-col items-center gap-3.5 rounded-[4px] bg-white p-7 text-center shadow-[0_30px_60px_-30px_rgb(22_24_29/0.4)] sm:left-12 sm:top-12">
        <span className="flex h-12 w-12 items-center justify-center rounded-[10px] font-bold text-white" style={{ background: EVENT_TEAL }}>
          BPS
        </span>
        <span className="serif text-[28px] leading-[1.05]">Brisbane Product Summit 2026</span>
        <span className="text-[13px] text-[color:var(--kb-ink-2)]">Scan for every photo you&apos;re in</span>
        <DrawnQr size={140} />
        <span className="mono text-[12px] text-[color:var(--kb-ink-3)]">events.klubbies.app/e/bps26</span>
      </div>
      <div className="absolute bottom-8 right-4 w-[300px] overflow-hidden rounded-[12px] bg-white shadow-[0_30px_60px_-30px_rgb(22_24_29/0.4)] sm:bottom-12 sm:right-10 sm:w-[320px]">
        <div className="flex flex-col gap-0.5 border-b border-[color:var(--kb-line)] px-[18px] py-3.5 text-[13px]">
          <span className="text-[color:var(--kb-ink-3)]">Subject</span>
          <span className="text-[14px] font-semibold">Your photos from Brisbane Product Summit</span>
        </div>
        <div className="flex flex-col gap-2.5 p-[18px] text-[14px] text-[color:var(--kb-ink-2)]">
          <span>Hi there, thanks for coming. Every photo from the day is ready, and you can find the ones you&apos;re in with one selfie.</span>
          <span className="self-start rounded-[6px] px-3.5 py-2 font-semibold text-white" style={{ background: EVENT_TEAL }}>
            Get my photos
          </span>
        </div>
      </div>
    </div>
  );
}

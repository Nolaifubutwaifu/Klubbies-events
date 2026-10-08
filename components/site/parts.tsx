import Image from "next/image";
import type { ReactNode } from "react";
import type { Feature } from "@/lib/copy/site";

/*
 * The drawn product pieces shared by the public pages. The product is shown as
 * drawn interface, filled with Klubbies' own marketing photos
 * (public/marketing), never with anything from a real event's private gallery.
 */

const PHOTOS = Array.from({ length: 12 }, (_, i) => `/marketing/sq-${i + 1}.webp`);

export function Tile({ index, className = "", src }: { index: number; className?: string; src?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-[4px] bg-[color:var(--kb-mist)] ${className}`} aria-hidden>
      <Image src={src ?? PHOTOS[index % PHOTOS.length]} alt="" fill sizes="(max-width: 768px) 30vw, 160px" className="object-cover" />
    </span>
  );
}

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
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  upload: <path d="M12 20V8M7 13l5-5 5 5M5 4h14" />,
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
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2.5v2.5H14zM18 18h2v2h-2zM18 14h2M14 18v2" />
    </>
  ),
  brand: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 15l3-6 2 4 1.5-2L17 15" />
    </>
  ),
};

export function FeatureIcon({ icon }: { icon: Feature["icon"] }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember)]" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
      </svg>
    </span>
  );
}

/** The attendee's "Your photos" screen, drawn at phone size. */
export function PhoneMock() {
  return (
    // A picture of the app, not the app: screen readers skip it.
    <div aria-hidden className="relative mx-auto w-[300px] rounded-[40px] border border-[color:var(--kb-line-strong)] bg-[#16181d] p-2.5 shadow-[0_40px_80px_-40px_rgb(22_24_29/0.55)]">
      <div className="overflow-hidden rounded-[31px] bg-[color:var(--kb-cream)]">
        <div className="flex items-center gap-2 border-b border-[color:var(--kb-line)] bg-white px-4 pb-3 pt-7">
          <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#0e7490] text-[14px] font-semibold text-white">PS</span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-tight">Product Summit 2026</span>
            <span className="block text-[14px] leading-tight text-[color:var(--kb-ink-3)]">14 Nov · Brisbane</span>
          </span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <span className="kb-eyebrow">Your photos</span>
          <span className="serif text-[30px]">23 photos of you</span>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }, (_, i) => (
              <Tile key={i} index={i} className="aspect-square" />
            ))}
          </div>
          <span className="flex gap-2">
            <span className="flex h-9 flex-1 items-center justify-center rounded-[8px] bg-[#16181d] text-[14px] font-medium text-white">Download all</span>
            <span className="flex h-9 flex-1 items-center justify-center rounded-[8px] border border-[color:var(--kb-line-strong)] bg-white text-[14px] font-medium">See all</span>
          </span>
          <span className="mt-1 text-[14px] font-semibold">Albums</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Awards night", "/marketing/cover-awards.webp"],
              ["Networking drinks", "/marketing/cover-drinks.webp"],
            ].map(([title, cover], i) => (
              <span key={title} className="flex flex-col gap-1">
                <Tile index={i} src={cover} className="aspect-[4/3]" />
                <span className="text-[14px] font-medium">{title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The organiser's share kit, drawn: a QR on a poster. */
export function PosterMock() {
  const cells = [
    "1111111001011111110",
    "1000001011010000010",
    "1011101001110111010",
    "1011101010010111010",
    "1011101011010111010",
    "1000001000110000010",
    "1111111010101111111",
    "0000000011100000000",
    "1101011100111010110",
    "0110100111001101001",
    "1011011010110010111",
    "0000000010011011010",
    "1111111011101010110",
    "1000001001010110001",
    "1011101011110011011",
    "1011101010101100101",
    "1011101001011010110",
    "1000001010110101001",
    "1111111011001011011",
  ];
  return (
    <div aria-hidden className="mx-auto flex aspect-[210/297] w-full max-w-[340px] flex-col rounded-[6px] border border-[color:var(--kb-line)] bg-white p-7 shadow-[0_30px_60px_-35px_rgb(22_24_29/0.45)]">
      <span className="text-[14px] font-medium uppercase tracking-[0.12em] text-[#0e7490]">Your photos from</span>
      <span className="serif mt-1 text-[34px]">Product Summit 2026</span>
      <span className="text-[14px] text-[color:var(--kb-ink-3)]">14 November · Brisbane</span>
      <div className="mt-auto flex items-end gap-4">
        <svg viewBox="0 0 19 19" className="w-[46%] flex-none" shapeRendering="crispEdges" aria-hidden>
          {cells.flatMap((row, y) => [...row].map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#16181d" /> : null)))}
        </svg>
        <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
          {["Scan", "Confirm your email", "Find yours"].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#0e7490] text-[14px] font-semibold text-white">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, lead, id }: { eyebrow: string; title: ReactNode; lead?: string; id?: string }) {
  return (
    <div className="flex max-w-[720px] flex-col gap-3">
      <span className="kb-eyebrow">{eyebrow}</span>
      <h2 id={id} className="kb-h2">
        {title}
      </h2>
      {lead ? <p className="kb-lead m-0">{lead}</p> : null}
    </div>
  );
}


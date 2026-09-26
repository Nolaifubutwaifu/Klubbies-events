import Link from "next/link";
import type { ReactNode } from "react";
import { Faq } from "@/components/site/Faq";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { ATTENDEE_FEATURES, FACE, FAQS, ORGANISER_FEATURES, PRICE, PRIVACY_PROMISES, STEPS, type Feature } from "@/lib/copy/site";

/*
 * The public home page, for organisers. No stock photography and no
 * testimonials: the photos in an event gallery are private by design, and we
 * have no customer quotes yet that could honestly go here. The product is
 * shown as drawn interface instead, with tonal tiles standing in for photos.
 */

const TONES = [
  "linear-gradient(135deg,#c9cdd6,#9aa1b1)",
  "linear-gradient(135deg,#d8d2c6,#b3a893)",
  "linear-gradient(135deg,#b9c4cf,#7f8fa0)",
  "linear-gradient(135deg,#e0d6cf,#c1ab9c)",
  "linear-gradient(135deg,#c4c9bd,#949d8a)",
  "linear-gradient(135deg,#d3d6de,#a9afbf)",
  "linear-gradient(135deg,#cfc7bf,#a39584)",
  "linear-gradient(135deg,#bfc8d3,#8e9cad)",
  "linear-gradient(135deg,#dcd9d2,#b7b1a4)",
];

function Tile({ index, className = "" }: { index: number; className?: string }) {
  return <span className={`block rounded-[4px] ${className}`} style={{ background: TONES[index % TONES.length] }} aria-hidden />;
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

function FeatureIcon({ icon }: { icon: Feature["icon"] }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[color:var(--kb-ember-tint)] text-[color:var(--kb-ember)]" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
      </svg>
    </span>
  );
}

/** The attendee's "Your photos" screen, drawn at phone size. */
function PhoneMock() {
  return (
    <div className="relative mx-auto w-[300px] rounded-[40px] border border-[color:var(--kb-line-strong)] bg-[#16181d] p-2.5 shadow-[0_40px_80px_-40px_rgb(22_24_29/0.55)]">
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
            {["Keynote", "Networking"].map((title, i) => (
              <span key={title} className="flex flex-col gap-1">
                <Tile index={i + 4} className="aspect-[4/3]" />
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
function PosterMock() {
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
    <div className="mx-auto flex aspect-[210/297] w-full max-w-[340px] flex-col rounded-[6px] border border-[color:var(--kb-line)] bg-white p-7 shadow-[0_30px_60px_-35px_rgb(22_24_29/0.45)]">
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

function SectionHeading({ eyebrow, title, lead, id }: { eyebrow: string; title: ReactNode; lead?: string; id?: string }) {
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

export function Home() {
  return (
    <>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="kb-section !pt-16 sm:!pt-24">
          <div className="kb-wrap grid items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="flex flex-col gap-6">
              <span className="kb-eyebrow">Private photo galleries for events</span>
              <h1 className="kb-h1 max-w-[14ch]">
                Every photo from your event, in every <span className="kb-accent">attendee&apos;s</span> hands.
              </h1>
              <p className="kb-lead m-0 max-w-[52ch]">
                Your photographers upload through their own links. Attendees scan a QR code, confirm their email and
                take a selfie. Each of them gets the photos they&apos;re in, at full quality, under your brand.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/start" className="btn btn-primary btn-lg no-underline">
                  Create an event
                </Link>
                <Link href="/#how" className="btn btn-secondary btn-lg no-underline">
                  How it works
                </Link>
              </div>
              <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">{PRICE.trust.join(" · ")}</p>
            </div>
            <PhoneMock />
          </div>
        </section>

        {/* How it works */}
        <section className="kb-section kb-sand" aria-labelledby="how">
          <div className="kb-wrap flex flex-col gap-12">
            <SectionHeading
              id="how"
              eyebrow="How it works"
              title="Set up before the event. Photos land after it."
              lead="No app for anyone to install, no accounts for photographers, and no shared drive links in a follow-up email."
            />
            <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-6">
                  <span className="serif text-[40px] text-[color:var(--kb-ember)]">{index + 1}</span>
                  <h3 className="kb-h3">{step.title}</h3>
                  <p className="kb-body m-0">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Face search */}
        <section className="kb-section" aria-labelledby="face">
          <div className="kb-wrap grid items-center gap-14 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <SectionHeading id="face" eyebrow="Face search" title={FACE.title} lead={FACE.lead} />
              <ul className="m-0 flex list-none flex-col gap-5 p-0">
                {FACE.points.map((point) => (
                  <li key={point.title} className="flex flex-col gap-1 border-l-2 border-[color:var(--kb-ember)] pl-4">
                    <span className="text-[16px] font-semibold">{point.title}</span>
                    <span className="kb-body">{point.body}</span>
                  </li>
                ))}
              </ul>
              <p className="kb-caption m-0">{FACE.caveat}</p>
            </div>
            <div className="rounded-[var(--kb-r-panel)] border border-[color:var(--kb-line)] bg-white p-6 sm:p-8">
              <span className="kb-eyebrow">What an attendee sees</span>
              <div className="mt-4 flex items-center gap-4">
                <span className="flex h-20 w-20 flex-none items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-3)]" aria-hidden>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <circle cx="12" cy="9" r="3.6" />
                    <path d="M5.5 20c.9-3.6 3.4-5.4 6.5-5.4s5.6 1.8 6.5 5.4" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[17px] font-semibold">Find the photos you&apos;re in</span>
                  <span className="block text-[14px] text-[color:var(--kb-ink-2)]">One selfie. Optional, and deletable any time.</span>
                </span>
              </div>
              <div className="mt-6 grid grid-cols-4 gap-1">
                {Array.from({ length: 8 }, (_, i) => (
                  <Tile key={i} index={i + 2} className="aspect-square" />
                ))}
              </div>
              <span className="mt-4 block text-[14px] text-[color:var(--kb-ink-2)]">
                Matched across Keynote, Breakouts and Networking drinks
              </span>
            </div>
          </div>
        </section>

        {/* For organisers */}
        <section className="kb-section kb-sand" aria-labelledby="organisers">
          <div className="kb-wrap flex flex-col gap-12">
            <SectionHeading
              id="organisers"
              eyebrow="For organisers"
              title="Looks like your event, runs itself."
              lead="Branded, private and quick to run, whether it is a 60-person meetup or a 2,000-person conference."
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ORGANISER_FEATURES.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-6">
                  <FeatureIcon icon={feature.icon} />
                  <h3 className="kb-h3">{feature.title}</h3>
                  <p className="kb-body m-0">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Share kit */}
        <section className="kb-section" aria-labelledby="share">
          <div className="kb-wrap grid items-center gap-14 lg:grid-cols-2">
            <PosterMock />
            <div className="flex flex-col gap-6">
              <SectionHeading
                id="share"
                eyebrow="Share kit"
                title="One QR code gets everyone in."
                lead="Print the A4 poster for the registration desk, put the code on the closing slide, or paste the ready-made email into your follow-up. It all points at one link that never changes."
              />
              <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                {ATTENDEE_FEATURES.map((feature) => (
                  <li key={feature.title} className="flex gap-3">
                    <FeatureIcon icon={feature.icon} />
                    <span>
                      <span className="block text-[15px] font-semibold">{feature.title}</span>
                      <span className="block text-[14px] text-[color:var(--kb-ink-2)]">{feature.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="kb-section kb-ink-band" aria-labelledby="privacy">
          <div className="kb-wrap flex flex-col gap-12">
            <div className="flex max-w-[720px] flex-col gap-3">
              <span className="kb-eyebrow !text-white/70">Privacy</span>
              <h2 id="privacy" className="kb-h2">
                Private is the default, <span className="kb-accent">not a setting</span>.
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {PRIVACY_PROMISES.map((promise) => (
                <div key={promise.title} className="flex flex-col gap-2 border-t border-white/20 pt-5">
                  <h3 className="kb-h3 !text-white">{promise.title}</h3>
                  <p className="m-0 text-[15px] leading-relaxed text-white/80">{promise.body}</p>
                </div>
              ))}
            </div>
            <Link href="/privacy" className="kb-link self-start !text-white">
              Read the privacy policy
            </Link>
          </div>
        </section>

        {/* Pricing */}
        <section className="kb-section" aria-labelledby="pricing">
          <div className="kb-wrap grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center">
            <SectionHeading
              id="pricing"
              eyebrow="Pricing"
              title="One price per event."
              lead="No subscription to cancel after the event, and no charge per attendee or per photo. Set up for free and pay when you activate."
            />
            <div className="flex flex-col gap-5 rounded-[var(--kb-r-panel)] border border-[color:var(--kb-line)] bg-white p-7 shadow-[0_24px_60px_-40px_rgb(22_24_29/0.4)]">
              <span className="kb-eyebrow">{PRICE.unit}</span>
              <span className="text-[52px] font-semibold leading-none tracking-[-0.03em]">{PRICE.amount}</span>
              <ul className="m-0 flex list-none flex-col p-0 text-[15px]">
                {PRICE.includes.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 border-t border-[color:var(--kb-line)] py-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--kb-ember)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/start" className="btn btn-primary btn-lg no-underline">
                Create an event
              </Link>
              <span className="kb-caption">{PRICE.note}</span>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="kb-section kb-sand" aria-labelledby="questions">
          <div className="kb-wrap grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <SectionHeading id="questions" eyebrow="Questions" title="Before you book the photographer." />
            <Faq items={FAQS} />
          </div>
        </section>

        {/* Closing */}
        <section className="kb-section">
          <div className="kb-wrap flex flex-col items-start gap-6">
            <h2 className="kb-h2 max-w-[18ch]">Your next event deserves better than a shared drive link.</h2>
            <Link href="/start" className="btn btn-primary btn-lg no-underline">
              Create an event
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

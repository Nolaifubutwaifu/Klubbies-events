import Link from "next/link";
import { Faq } from "@/components/site/Faq";
import { FaceMatchVisual, HeroShowcase, PhotoStrip, StepVisual, Tick } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { TIERS } from "@/lib/billing/plans";
import { FACE, FAQS, HOME_QUESTIONS, PRICE, STEPS } from "@/lib/copy/site";

/*
 * The public home page, for organisers: what it is, how it works, face search,
 * the price in one line and the top questions. Everything else has its own
 * page (/features, /pricing, /faq), so this stays a few screens long. No
 * testimonials: we have no customer quotes yet that could honestly go here.
 */

const FACTS = [
  { label: "For attendees", title: "No app to install", body: "The gallery works in any phone or laptop browser." },
  { label: "For photographers", title: "No account needed", body: "Each one gets their own upload link." },
  { label: "Data", title: "Stored in Sydney", body: "Faceprints never leave Australia." },
  { label: "Access", title: "Open for 12 months", body: "On every size, Free included." },
];

const FACE_ICONS = [
  <g key="person">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </g>,
  <g key="lock">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </g>,
  <path key="bin" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
];

/** Inside the iPhone app prices and the pricing band are left out: Apple allows no payment prompts there. */
export function Home({ inApp = false }: { inApp?: boolean }) {
  const faqs = HOME_QUESTIONS.map((q) => FAQS.find((item) => item.q === q)).filter(
    (item): item is (typeof FAQS)[number] => Boolean(item) && !(inApp && item?.group === "Pricing"),
  );
  return (
    <>
      <SiteNav inApp={inApp} />
      <main>
        {/* Hero */}
        <section className="pb-16 pt-12 sm:pb-24 sm:pt-[88px]">
          <div className="kb-wrap grid items-center gap-16 lg:grid-cols-2">
            <div className="flex flex-col gap-7">
              {/* The search words sit in the h1 (audit F14); the headline keeps its look as the line under it. */}
              <h1 className="kb-eyebrow">Event photo sharing with face search</h1>
              <p className="kb-h1 max-w-[13ch]">
                Every photo from your event, in every <em className="kb-accent">attendee&apos;s</em> hands.
              </p>
              <p className="kb-lead m-0 max-w-[50ch]">
                A private photo gallery for your event. Photographers upload through their own links. Attendees scan a
                QR code and take a selfie, and facial recognition shows each of them the photos they&apos;re in, at full
                quality, under your brand.
              </p>
              <p className="m-0 max-w-[52ch] text-[16px] leading-[1.6]">
                Built for <Link href="/christmas-parties">work Christmas parties</Link>,{" "}
                <Link href="/conferences">conferences and corporate events</Link> and <Link href="/student-clubs">club nights</Link>.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/start" className="btn btn-primary btn-lg no-underline">
                  Create an event
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link href="/how-it-works" className="btn btn-secondary btn-lg no-underline">
                  How it works
                </Link>
              </div>
              {inApp ? null : (
                <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-[15px] text-[color:var(--kb-ink-2)]">
                  {PRICE.trust.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Tick />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <HeroShowcase />
          </div>
        </section>

        {/* Facts strip */}
        <section aria-label="At a glance" className="border-y border-[color:var(--kb-line)] bg-white">
          <div className="kb-wrap grid sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((fact, index) => (
              <div
                key={fact.title}
                className={[
                  "flex flex-col gap-1.5 border-[color:var(--kb-line)] py-6 sm:py-8",
                  // One column: rules between. Two: a cross. Four: rules between, edges flush.
                  index > 0 ? "border-t" : "",
                  index === 1 ? "sm:border-t-0" : "",
                  index % 2 === 1 ? "sm:border-l sm:pl-6" : "sm:pr-6",
                  index === 2 ? "lg:border-l lg:pl-6" : "",
                  index > 0 ? "lg:border-t-0" : "",
                  index === 3 ? "lg:pr-0" : "",
                ].join(" ")}
              >
                <span className="mono text-[14px] text-[color:var(--kb-brand)]">{fact.label}</span>
                <span className="text-[17px] font-semibold">{fact.title}</span>
                <span className="text-[15px] text-[color:var(--kb-ink-2)]">{fact.body}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="kb-section" aria-labelledby="how">
          <div className="kb-wrap flex flex-col gap-14">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex max-w-[640px] flex-col gap-4">
                <span className="kb-eyebrow">How it works</span>
                <h2 id="how" className="kb-h2">
                  Three steps, and the photos find their people.
                </h2>
              </div>
              <Link href="/how-it-works" className="text-[15px] font-semibold">
                See the full walkthrough
              </Link>
            </div>
            <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="kb-tile flex flex-col overflow-hidden">
                  <StepVisual step={index as 0 | 1 | 2} />
                  <div className="flex flex-col gap-2.5 p-7">
                    <span className="mono text-[14px] text-[color:var(--kb-ink-3)]">0{index + 1}</span>
                    <h3 className="text-[22px] font-semibold tracking-[-0.01em]">{step.title}</h3>
                    <p className="kb-body m-0">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Face search */}
        <section className="kb-section border-y border-[color:var(--kb-line)] bg-white" aria-labelledby="face">
          <div className="kb-wrap grid items-center gap-[72px] lg:grid-cols-2">
            <FaceMatchVisual />
            <div className="flex flex-col gap-7">
              <span className="kb-eyebrow">Face search</span>
              <h2 id="face" className="kb-h2">
                {FACE.title}.
              </h2>
              <p className="m-0 text-[18px] text-[color:var(--kb-ink-2)]">{FACE.lead}</p>
              <ul className="m-0 flex list-none flex-col border-t border-[color:var(--kb-line)] p-0">
                {FACE.points.map((point, index) => (
                  <li key={point.title} className="flex gap-4 border-b border-[color:var(--kb-line)] py-5">
                    <span className="kb-icon-well !h-10 !w-10" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        {FACE_ICONS[index]}
                      </svg>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[17px] font-semibold">{point.title}</span>
                      <span className="text-[color:var(--kb-ink-2)]">{point.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
                {FACE.caveat} <Link href="/face-search-privacy">How face search handles privacy</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Price, in one line */}
        {inApp ? null : (
          <section className="kb-section !pb-0" aria-labelledby="pricing">
            <div className="kb-wrap">
              <div className="kb-night-band flex flex-wrap items-center justify-between gap-8 p-8 sm:p-14">
                <div className="flex max-w-[620px] flex-col gap-3.5">
                  <span className="kb-eyebrow">Pricing</span>
                  <h2 id="pricing" className="kb-h2 !text-[52px] max-sm:!text-[38px]">
                    Free for up to {TIERS.free.guests} guests.
                  </h2>
                  <p className="m-0 text-[18px] text-[color:var(--kb-night-ink)]">
                    Bigger events pay once, from A${TIERS.small.price.standard}. No subscription, and every size gets
                    the full gallery.
                  </p>
                </div>
                <Link href="/pricing" className="btn btn-light btn-lg no-underline">
                  See pricing
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Questions */}
        <section className="kb-section" aria-labelledby="questions">
          <div className="kb-wrap flex flex-wrap gap-14">
            <div className="flex flex-[1_1_320px] flex-col items-start gap-4">
              <span className="kb-eyebrow">FAQ</span>
              <h2 id="questions" className="kb-h2 !text-[48px] max-sm:!text-[38px]">
                Frequently asked questions
              </h2>
              <Link href="/faq" className="text-[15px] font-semibold">
                See all questions
              </Link>
            </div>
            <div className="min-w-0 flex-[2_1_560px]">
              <Faq items={faqs} openFirst />
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-[color:var(--kb-line)] bg-white pt-16 sm:pt-28">
          <div className="kb-wrap flex flex-col items-center gap-7 text-center">
            <h2 className="kb-h2 max-w-[16ch] !text-[64px] !leading-[1.02] max-sm:!text-[40px]">
              Your next event deserves better than a shared drive link.
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/start" className="btn btn-primary btn-lg no-underline">
                Create an event
              </Link>
              {inApp ? (
                <Link href="/features" className="btn btn-secondary btn-lg no-underline">
                  See all features
                </Link>
              ) : (
                <Link href="/pricing" className="btn btn-secondary btn-lg no-underline">
                  See pricing
                </Link>
              )}
            </div>
          </div>
          <PhotoStrip />
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

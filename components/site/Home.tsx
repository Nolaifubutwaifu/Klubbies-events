import Image from "next/image";
import Link from "next/link";
import { Faq } from "@/components/site/Faq";
import { PhoneMock, SectionHeading, Tile } from "@/components/site/parts";
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
        <section className="kb-section !pt-12 sm:!pt-24">
          <div className="kb-wrap grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="flex flex-col gap-6">
              <span className="kb-eyebrow">Private photo galleries for events</span>
              <h1 className="kb-h1 max-w-[14ch]">
                Every photo from your event, in every <span className="kb-accent">attendee&apos;s</span> hands.
              </h1>
              <p className="kb-lead m-0 max-w-[52ch]">
                Photographers upload through their own links. Attendees scan a QR code and take a selfie, and each of
                them gets the photos they&apos;re in, at full quality, under your brand.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/start" className="btn btn-primary btn-lg no-underline">
                  Create an event
                </Link>
                <Link href="/how-it-works" className="btn btn-secondary btn-lg no-underline">
                  How it works
                </Link>
              </div>
              {inApp ? null : (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {PRICE.trust.map((item) => (
                    <li key={item} className="kb-pill-brand">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <PhoneMock />
          </div>
        </section>

        {/* How it works */}
        <section className="kb-section kb-sand" aria-labelledby="how">
          <div className="kb-wrap flex flex-col gap-10">
            <SectionHeading id="how" eyebrow="How it works" title="Three steps, and the photos find their people." />
            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-5 md:flex-col md:p-6">
                  <span className="kb-step-number" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-2">
                    <h3 className="kb-h3">{step.title}</h3>
                    <p className="kb-body m-0">{step.body}</p>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-5">
              <Link href="/how-it-works" className="kb-link">
                See the full walkthrough
              </Link>
              <Link href="/features" className="kb-link">
                See everything organisers get
              </Link>
            </div>
          </div>
        </section>

        {/* Face search */}
        <section className="kb-section" aria-labelledby="face">
          <div className="kb-wrap grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <SectionHeading id="face" eyebrow="Face search" title={FACE.title} lead={FACE.lead} />
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {FACE.points.map((point) => (
                  <li key={point.title} className="flex flex-col gap-1 border-l-2 border-[color:var(--kb-brand)] pl-4">
                    <span className="text-[16px] font-semibold">{point.title}</span>
                    <span className="kb-body">{point.body}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--kb-r-panel)] border border-[color:var(--kb-line)] bg-white p-6 sm:p-8">
              <span className="kb-eyebrow">What an attendee sees</span>
              <div className="mt-4 flex items-center gap-4">
                <span className="relative block h-20 w-20 flex-none overflow-hidden rounded-full" aria-hidden>
                  <Image src="/marketing/selfie.webp" alt="" fill sizes="80px" className="object-cover" />
                </span>
                <span>
                  <span className="block text-[17px] font-semibold">Find the photos you&apos;re in</span>
                  <span className="block text-[14px] text-[color:var(--kb-ink-2)]">One selfie. Optional, and deletable any time.</span>
                </span>
              </div>
              <div className="mt-6 grid grid-cols-4 gap-1">
                {Array.from({ length: 8 }, (_, i) => (
                  <Tile key={i} index={i + 4} className="aspect-square" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Price, in one line */}
        {inApp ? null : (
          <section className="kb-section !py-0" aria-labelledby="pricing">
            <div className="kb-wrap">
              <div className="kb-brand-band flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
                <div className="flex max-w-[560px] flex-col gap-2">
                  <span className="kb-eyebrow !text-[color:var(--kb-brand)]">Pricing</span>
                  <h2 id="pricing" className="kb-h2">
                    Free for up to {TIERS.free.guests} guests.
                  </h2>
                  <p className="kb-lead m-0">
                    Bigger events pay once, from A${TIERS.small.price.standard}. No subscription, and every size gets
                    every feature.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/pricing" className="btn btn-primary btn-lg no-underline">
                    See pricing
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Questions */}
        <section className="kb-section" aria-labelledby="questions">
          <div className="kb-wrap grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-4">
              <SectionHeading id="questions" eyebrow="FAQ" title="Frequently asked questions" />
              <Link href="/faq" className="kb-link self-start">
                See all questions
              </Link>
            </div>
            <Faq items={faqs} />
          </div>
        </section>

        {/* Closing */}
        <section className="kb-section kb-sand">
          <div className="kb-wrap flex flex-col items-start gap-6">
            <h2 className="kb-h2 max-w-[18ch]">Your next event deserves better than a shared drive link.</h2>
            <Link href="/start" className="btn btn-primary btn-lg no-underline">
              Create an event
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

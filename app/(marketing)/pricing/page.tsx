import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Faq } from "@/components/site/Faq";
import { SectionHeading } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { TIER_ORDER, TIERS } from "@/lib/billing/plans";
import { FAQS, PRICE } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free for up to ${TIERS.free.guests} guests. Bigger events pay once, from A$${TIERS.small.price.standard}.`,
};

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--kb-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-1 flex-none">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

/** Prices, one card per size. Never shown inside the iPhone app (no payment prompts there). */
export default async function PricingPage() {
  if (await isNativeAppRequest()) redirect("/");

  return (
    <>
      <SiteNav current="pricing" />
      <main>
        <section className="kb-section !pb-10 !pt-12 sm:!pt-20">
          <div className="kb-wrap flex flex-col gap-4">
            <span className="kb-eyebrow">Pricing</span>
            <h1 className="kb-h1 max-w-[18ch]">One payment per event. Free for small ones.</h1>
            <p className="kb-lead m-0 max-w-[56ch]">
              Pick a size by how many guests you expect. No subscription to cancel afterwards, and every size gets every
              feature.
            </p>
          </div>
        </section>

        <section className="kb-section !pt-0" aria-label="Sizes">
          <div className="kb-wrap flex flex-col gap-6">
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {TIER_ORDER.map((tier) => {
                const spec = TIERS[tier];
                const free = spec.price.standard === 0;
                return (
                  <li
                    key={tier}
                    className={`flex flex-col gap-4 rounded-[var(--kb-r-panel)] border bg-white p-6 ${free ? "border-[color:var(--kb-brand)] shadow-[0_0_0_1px_var(--kb-brand)]" : "border-[color:var(--kb-line)]"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-[20px] font-semibold">{spec.name}</h2>
                      {free ? <span className="kb-pill-brand">No card needed</span> : null}
                    </div>
                    <p className="m-0 flex items-baseline gap-2">
                      <span className="text-[40px] font-semibold leading-none tracking-[-0.03em]">A${spec.price.standard}</span>
                      <span className="text-[14px] text-[color:var(--kb-ink-3)]">per event</span>
                    </p>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px]">
                      <li className="flex gap-2.5">
                        <Check />
                        Up to {spec.guests.toLocaleString("en-AU")} guests
                      </li>
                      <li className="flex gap-2.5">
                        <Check />
                        {spec.photos.toLocaleString("en-AU")} photos and videos
                      </li>
                      {free ? null : (
                        <li className="flex gap-2.5 text-[color:var(--kb-ink-2)]">
                          <Check />
                          Student clubs: A${spec.price.club}
                        </li>
                      )}
                    </ul>
                    <Link href="/start" className={`btn ${free ? "btn-primary" : "btn-secondary"} mt-auto w-full no-underline`}>
                      {free ? "Start free" : "Create an event"}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 rounded-[var(--kb-r-panel)] border border-[color:var(--kb-line)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[15px]">
                <strong>More than {TIERS.large.guests.toLocaleString("en-AU")} guests?</strong> We&apos;ll quote a size
                that fits.
              </span>
              <Link href="/support" className="btn btn-secondary no-underline">
                Ask us
              </Link>
            </div>
          </div>
        </section>

        <section className="kb-section kb-sand">
          <div className="kb-wrap grid gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <SectionHeading eyebrow="Every size" title="Everything is included." />
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[16px]">
                {PRICE.includes.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-5">
                <h3 className="kb-h3">More guests than you planned?</h3>
                <p className="kb-body m-0 mt-2">{PRICE.footnote}</p>
              </div>
              <div className="rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-5">
                <h3 className="kb-h3">Student clubs</h3>
                <p className="kb-body m-0 mt-2">{PRICE.clubs} Enter it when you choose your event&apos;s size.</p>
              </div>
              <div className="rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-5">
                <h3 className="kb-h3">Videos</h3>
                <p className="kb-body m-0 mt-2">
                  Each started minute of video counts as 10 photos, so a 2 minute clip counts as 20.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="kb-section" aria-labelledby="price-questions">
          <div className="kb-wrap grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-4">
              <SectionHeading id="price-questions" eyebrow="FAQ" title="Questions about pricing" />
              <Link href="/faq" className="kb-link self-start">
                See all questions
              </Link>
            </div>
            <Faq items={FAQS.filter((item) => item.group === "Pricing")} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

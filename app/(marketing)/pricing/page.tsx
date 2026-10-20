import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Faq } from "@/components/site/Faq";
import { Tick } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { TIER_ORDER, TIERS } from "@/lib/billing/plans";
import { FAQS, PRICE } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `Pricing: Free up to ${TIERS.free.guests} Guests, From A$${TIERS.small.price.standard}`,
  description: `Free for up to ${TIERS.free.guests} guests and ${TIERS.free.photos} photos. Bigger events pay once: A$${TIERS.small.price.standard}, A$${TIERS.medium.price.standard} or A$${TIERS.large.price.standard} by size. No subscription, no limit on photographers.`,
  path: "/pricing",
});

function Spec({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 border-t border-[color:var(--kb-line)] py-3 text-[15px] ${last ? "border-b" : ""}`}>
      <span className="text-[color:var(--kb-ink-2)]">{label}</span>
      <span className="mono font-medium">{value}</span>
    </div>
  );
}

/** Prices, one card per size. Never shown inside the iPhone app (no payment prompts there). */
export default async function PricingPage() {
  if (await isNativeAppRequest()) redirect("/");

  return (
    <>
      <SiteNav current="pricing" />
      <main>
        <section className="pb-12 pt-12 sm:pb-16 sm:pt-24">
          <div className="kb-wrap flex flex-col items-center gap-5 text-center">
            <span className="kb-eyebrow">Pricing</span>
            <h1 className="kb-h1 max-w-[14ch] !text-[80px] !leading-none max-sm:!text-[50px]">One payment per event. Free for small ones.</h1>
            <p className="kb-lead m-0 max-w-[52ch]">
              Free for up to {TIERS.free.guests} guests and {TIERS.free.photos} photos, no card needed. Bigger events pay
              once, by size. No subscription.
            </p>
          </div>
        </section>

        <section className="pb-16 sm:pb-24" aria-label="Sizes">
          <div className="kb-wrap flex flex-col gap-5">
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {TIER_ORDER.map((tier) => {
                const spec = TIERS[tier];
                const free = spec.price.standard === 0;
                return (
                  <li
                    key={tier}
                    className={`flex flex-col gap-5 rounded-[14px] bg-white ${free ? "border-2 border-[color:var(--kb-brand)] p-[31px]" : "border border-[color:var(--kb-line)] p-8"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-[20px] font-semibold">{spec.name}</h2>
                      {free ? <span className="kb-pill-brand !min-h-[28px] font-semibold">No card needed</span> : null}
                    </div>
                    <p className="m-0 flex items-baseline gap-2">
                      <span className="serif text-[64px] leading-none">A${spec.price.standard}</span>
                      {free ? null : <span className="text-[15px] text-[color:var(--kb-ink-2)]">per event</span>}
                    </p>
                    <div>
                      <Spec label="Guests" value={`up to ${spec.guests.toLocaleString("en-AU")}`} />
                      <Spec label="Photos" value={spec.photos.toLocaleString("en-AU")} />
                      <Spec label="Gallery open" value="12 months" last />
                    </div>
                    <Link href="/start" className={`btn ${free ? "btn-primary" : "btn-secondary"} btn-lg mt-auto w-full no-underline`}>
                      Create an event
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="m-0 text-center text-[15px] text-[color:var(--kb-ink-2)]">
              More than {TIERS.large.guests.toLocaleString("en-AU")} guests? <Link href="/support#contact">Ask us</Link> and
              we&apos;ll quote a size that fits.
            </p>
          </div>
        </section>

        <section className="border-y border-[color:var(--kb-line)] bg-white py-16 sm:py-24" aria-labelledby="inc">
          <div className="kb-wrap flex flex-wrap gap-14">
            <div className="flex flex-[1_1_320px] flex-col gap-4">
              <span className="kb-eyebrow">Every size</span>
              <h2 id="inc" className="kb-h2 !text-[52px] !leading-[1.02] max-sm:!text-[38px]">
                Everything is included.
              </h2>
              <p className="m-0 text-[17px] text-[color:var(--kb-ink-2)]">
                Sizes differ only in guests and photos. No feature is held back, and there&apos;s no limit on photographers.
              </p>
            </div>
            <ul className="m-0 grid flex-[2_1_560px] list-none gap-x-8 p-0 sm:grid-cols-2">
              {PRICE.includes.map((item) => (
                <li key={item} className="flex gap-3 border-t border-[color:var(--kb-line)] py-[18px]">
                  <Tick size={20} className="mt-[3px]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-label="Details">
          <div className="kb-wrap grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "More guests than you planned?", body: "They can usually keep joining for a short while, and we'll email you. Moving up before that point costs less than after it." },
              { title: "Student clubs", body: `Club prices from A$${TIERS.small.price.club} with your campus club code. Enter it when you choose your event's size.` },
              { title: "Announcement email, sent for you", body: "On paid sizes we send your announcement to every guest, in your own words." },
              { title: "Videos", body: "Video counts by length: 1 photo per 6 seconds, so a minute counts as 10." },
            ].map((card) => (
              <div key={card.title} className="flex flex-col gap-2.5 rounded-[12px] border border-[color:var(--kb-line)] bg-white p-7">
                <h3 className="text-[18px] font-semibold">{card.title}</h3>
                <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-20 sm:pb-[120px]" aria-labelledby="price-questions">
          <div className="kb-wrap flex flex-wrap gap-14">
            <div className="flex flex-[1_1_300px] flex-col items-start gap-4">
              <h2 id="price-questions" className="kb-h2 !text-[44px] max-sm:!text-[36px]">
                Questions about pricing
              </h2>
              <Link href="/faq" className="text-[15px] font-semibold">
                See all questions
              </Link>
            </div>
            <div className="min-w-0 flex-[2_1_560px]">
              <Faq items={FAQS.filter((item) => item.group === "Pricing")} openFirst />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

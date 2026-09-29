import type { Metadata } from "next";
import Link from "next/link";
import { FeatureIcon, PosterMock, SectionHeading } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { ATTENDEE_FEATURES, ORGANISER_FEATURES, ORGANISERS, PRIVACY_PROMISES } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";

export const metadata: Metadata = { title: "Features" };

/** What organisers and attendees get, moved off the home page to keep it short. */
export default async function FeaturesPage() {
  const inApp = await isNativeAppRequest();
  return (
    <>
      <SiteNav current="features" inApp={inApp} />
      <main>
        <section className="kb-section !pb-10 !pt-12 sm:!pt-20" aria-labelledby="organisers">
          <div className="kb-wrap flex flex-col gap-10">
            <div className="flex max-w-[720px] flex-col gap-4">
              <span className="kb-eyebrow">Features</span>
              <h1 id="organisers" className="kb-h1">
                {ORGANISERS.title}
              </h1>
              <p className="kb-lead m-0">{ORGANISERS.lead}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {ORGANISER_FEATURES.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-3 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-6">
                  <FeatureIcon icon={feature.icon} />
                  <h2 className="kb-h3">{feature.title}</h2>
                  <p className="kb-body m-0">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="kb-section kb-sand" aria-labelledby="share">
          <div className="kb-wrap grid items-center gap-12 lg:grid-cols-2">
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

        <section className="kb-section kb-ink-band" aria-labelledby="privacy">
          <div className="kb-wrap flex flex-col gap-10">
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

        <section className="kb-section">
          <div className="kb-wrap flex flex-col items-start gap-6">
            <h2 className="kb-h2 max-w-[18ch]">Ready when your photographer is.</h2>
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

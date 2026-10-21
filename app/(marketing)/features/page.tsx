import type { Metadata } from "next";
import Link from "next/link";
import { FeatureIcon, Photo, ShareKitVisual, Tick } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { ATTENDEE_FEATURES, ORGANISER_FEATURES, ORGANISERS, PAID_SIZES_NOTE, PRIVACY_PROMISES } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Features: Face Search, QR Access, Branding",
  description: "Face search, guest lists, photographer upload links, your logo and colour, full quality downloads. Data stored in Sydney. See every feature.",
  path: "/features",
});

/** One photo per attendee feature, in ATTENDEE_FEATURES order. */
const ATTENDEE_PHOTOS = ["selfie", "sq-5", "sq-4", "sq-7"];

function GroupLabel({ id, n, children }: { id: string; n: string; children: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-[15px] font-semibold tracking-normal text-[color:var(--kb-ink-2)]">
      <span className="mono text-[color:var(--kb-brand)]">{n}</span>{" "}
      {children}
    </h2>
  );
}

/** What organisers and attendees get, moved off the home page to keep it short. */
export default async function FeaturesPage() {
  const inApp = await isNativeAppRequest();
  return (
    <>
      <SiteNav current="features" inApp={inApp} />
      <main>
        <section className="py-14 sm:py-24">
          <div className="kb-wrap flex flex-wrap items-end justify-between gap-14">
            <div className="flex flex-[1_1_560px] flex-col gap-6">
              <span className="kb-eyebrow">Features</span>
              <h1 className="kb-h1 max-w-[13ch] !text-[80px] !leading-none max-sm:!text-[50px]">{ORGANISERS.title}</h1>
            </div>
            <p className="kb-lead m-0 max-w-[44ch] flex-[1_1_360px]">
              Everything an organiser needs to look professional in front of a client, and everything an attendee needs
              to leave with their photos.
            </p>
          </div>
        </section>

        {/* Organiser features */}
        <section className="pb-16 sm:pb-28" aria-labelledby="org">
          <div className="kb-wrap flex flex-col gap-8">
            <GroupLabel id="org" n="01">
              For organisers
            </GroupLabel>
            <div className="grid border-l border-t border-[color:var(--kb-line)] border-t-[color:var(--kb-line-strong)] bg-white sm:grid-cols-2 lg:grid-cols-3">
              {/* In the app, nothing about paid sizes (Apple 3.1.1). */}
              {ORGANISER_FEATURES.map((feature) => (inApp ? { ...feature, body: feature.body.replace(PAID_SIZES_NOTE, "") } : feature)).map((feature) => (
                <div key={feature.title} className="flex flex-col gap-3.5 border-b border-r border-[color:var(--kb-line)] p-7 sm:p-9">
                  <FeatureIcon icon={feature.icon} />
                  <h3 className="text-[20px] font-semibold">{feature.title}</h3>
                  <p className="kb-body m-0">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Share kit spotlight */}
        <section className="border-y border-[color:var(--kb-line)] bg-white py-16 sm:py-28" aria-labelledby="kit">
          <div className="kb-wrap flex flex-wrap items-center gap-[72px]">
            <div className="flex flex-[1_1_400px] flex-col gap-5">
              <span className="kb-eyebrow">Share kit</span>
              <h2 id="kit" className="kb-h2 !leading-[1.02]">
                One QR code gets everyone in.
              </h2>
              <p className="m-0 text-[18px] text-[color:var(--kb-ink-2)]">
                Print the A4 poster for the registration desk, put the code on the closing slide, or paste the
                ready-made email into your follow-up. It all points at one link that never changes.
              </p>
            </div>
            <div className="min-w-0 flex-[1_1_520px]">
              <ShareKitVisual />
            </div>
          </div>
        </section>

        {/* Attendee features */}
        <section className="py-16 sm:py-28" aria-labelledby="att">
          <div className="kb-wrap flex flex-col gap-8">
            <GroupLabel id="att" n="02">
              For attendees
            </GroupLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ATTENDEE_FEATURES.map((feature, index) => (
                <div key={feature.title} className="kb-tile overflow-hidden">
                  <Photo name={ATTENDEE_PHOTOS[index]} className="h-[180px] w-full" sizes="(max-width: 640px) 100vw, 300px" />
                  <div className="flex flex-col gap-2 p-6">
                    <h3 className="text-[19px] font-semibold">{feature.title}</h3>
                    <p className="kb-body m-0">{feature.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-[color:var(--kb-night)] py-16 text-white sm:py-28" aria-labelledby="privacy">
          <div className="kb-wrap flex flex-col gap-14">
            <div className="flex max-w-[760px] flex-col gap-[18px]">
              <span className="kb-eyebrow !text-[#b3c1f6]">Privacy</span>
              <h2 id="privacy" className="kb-h2 !text-[60px] !leading-[1.02] !text-white max-sm:!text-[40px]">
                Privacy is the product, <em className="italic text-[#b3c1f6]">not a setting</em>.
              </h2>
            </div>
            <div className="grid border-t border-[color:var(--kb-night-line)] md:grid-cols-3">
              {PRIVACY_PROMISES.map((promise, index) => (
                <div key={promise.title} className="flex flex-col gap-2.5 pr-8 pt-8">
                  <span className="mono text-[14px] text-[#b3c1f6]">0{index + 1}</span>
                  <h3 className="text-[20px] font-semibold !text-white">{promise.title}</h3>
                  <p className="m-0 text-[color:var(--kb-night-ink)]">{promise.body}</p>
                </div>
              ))}
            </div>
            <Link href="/privacy" className="self-start font-semibold !text-white">
              Read the privacy policy
            </Link>
          </div>
        </section>

        {/* Closing */}
        <section className="py-16 sm:py-28">
          <div className="kb-wrap flex flex-wrap items-center justify-between gap-12">
            <div className="flex flex-[1_1_480px] flex-col gap-[18px]">
              <h2 className="kb-h2 !text-[60px] !leading-[1.02] max-sm:!text-[40px]">Ready when your photographer is.</h2>
              <p className="m-0 max-w-[50ch] text-[18px] text-[color:var(--kb-ink-2)]">
                Set the event up today, hand out the upload links, and the photos land in the right albums as the night
                goes on.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link href="/start" className="btn btn-primary btn-lg no-underline">
                  Create an event
                </Link>
                <Link href="/how-it-works" className="btn btn-secondary btn-lg no-underline">
                  See how it works
                </Link>
              </div>
            </div>
            <ul className="m-0 flex flex-[1_1_360px] list-none flex-col gap-4 rounded-[14px] border border-[color:var(--kb-line)] bg-white p-7">
              {[
                "Ten minutes to set up, no app for anyone to install",
                "Photographers upload full resolution through their own link",
                "Attendees find their own photos with one selfie",
              ].map((point) => (
                <li key={point} className="flex gap-3">
                  <Tick size={20} className="mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

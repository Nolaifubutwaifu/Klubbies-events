import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/site/Faq";
import { ClosingCta, PhoneMock, PosterMock, SectionHeading, Tile } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { FAQS, STEPS } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";

export const metadata: Metadata = {
  title: "How it works",
  description: "From setting up the event to every attendee holding the photos they're in: the whole flow, step by step.",
};

type Stage = { eyebrow: string; title: string; lead: string; steps: { title: string; body: string }[] };

const ORGANISER: Stage = {
  eyebrow: "Before the event",
  title: "Set it up once, in about ten minutes.",
  lead: "Everything is done in the browser or the iPhone app. Nothing for your guests to install.",
  steps: [
    { title: "Create the event", body: "Give it a name, a date and a venue. It gets one link and one QR code that never change." },
    { title: "Make it yours", body: "Add your logo and colour. Attendees see your brand on the join page, the gallery and the poster." },
    { title: "Choose who gets in", body: "Anyone with the link, or only the people on your guest list. Import a list from Eventbrite, Humanitix, Luma or a spreadsheet." },
    { title: "Plan the albums", body: "One album per part of the event works best: keynote, breakouts, drinks, headshots. Publish each when it's ready, or schedule it." },
  ],
};

const PHOTOGRAPHER: Stage = {
  eyebrow: "During the event",
  title: "Photographers upload straight into the right album.",
  lead: "Each photographer gets their own upload link. No account, no app, no shared drive.",
  steps: [
    { title: "Send each photographer a link", body: "Copy it, email it from the app, or let them scan a QR code. Each link uploads into one album until the date you set." },
    { title: "Full resolution, in the background", body: "Photos and videos upload at full quality and pick up where they left off if the connection drops." },
    { title: "Credited by name", body: "Every photo carries the photographer's name, so attendees know who took it." },
  ],
};

const ATTENDEE: Stage = {
  eyebrow: "After the event",
  title: "Every attendee finds the photos they're in.",
  lead: "Put the QR code on the closing slide, a table card or the follow-up email.",
  steps: [
    { title: "Scan and confirm", body: "Attendees scan the code, enter their name and email, and type the code we send. No password to remember." },
    { title: "One selfie, optional", body: "Take a selfie and only that person sees every photo they appear in. Nobody can search for anyone else." },
    { title: "Keep them", body: "Save straight to the phone's photo library, download albums at full quality, or keep favourites for later." },
  ],
};

function StageSection({ stage, id, visual, sand = false }: { stage: Stage; id: string; visual: React.ReactNode; sand?: boolean }) {
  return (
    <section className={`kb-section ${sand ? "kb-sand" : ""}`} aria-labelledby={id}>
      <div className="kb-wrap grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <SectionHeading id={id} eyebrow={stage.eyebrow} title={stage.title} lead={stage.lead} />
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {stage.steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="kb-step-number" aria-hidden>
                  {index + 1}
                </span>
                <span className="flex flex-col gap-1">
                  <h3 className="kb-h3">{step.title}</h3>
                  <p className="kb-body m-0">{step.body}</p>
                </span>
              </li>
            ))}
          </ol>
        </div>
        {visual}
      </div>
    </section>
  );
}

/** The whole flow on its own page; the home page keeps a three step summary that links here. */
export default async function HowItWorksPage() {
  const inApp = await isNativeAppRequest();
  const questions = FAQS.filter((item) => item.group !== "Pricing").slice(0, 5);

  return (
    <>
      <SiteNav current="how" inApp={inApp} />
      <main>
        <section className="kb-section !pb-10 !pt-12 sm:!pt-20" aria-labelledby="how">
          <div className="kb-wrap flex flex-col gap-10">
            <div className="flex max-w-[720px] flex-col gap-4">
              <span className="kb-eyebrow">How it works</span>
              <h1 id="how" className="kb-h1">
                From the first photo to every <span className="kb-accent">attendee&apos;s</span> phone.
              </h1>
              <p className="kb-lead m-0">
                Three people use Klubbies Events: you set the event up, photographers upload, and attendees find
                themselves. Here is what each of them does.
              </p>
            </div>
            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-[var(--kb-r-card)] border border-[color:var(--kb-line)] bg-white p-5 md:flex-col md:p-6">
                  <span className="kb-step-number" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-2">
                    <h2 className="kb-h3">{step.title}</h2>
                    <p className="kb-body m-0">{step.body}</p>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <StageSection stage={ORGANISER} id="organisers" sand visual={<PosterMock />} />
        <StageSection
          stage={PHOTOGRAPHER}
          id="photographers"
          visual={
            <div className="grid grid-cols-3 gap-1.5" aria-hidden>
              {Array.from({ length: 9 }, (_, i) => (
                <Tile key={i} index={i} className="aspect-square" />
              ))}
            </div>
          }
        />
        <StageSection stage={ATTENDEE} id="attendees" sand visual={<PhoneMock />} />

        <section className="kb-section" aria-labelledby="privacy">
          <div className="kb-wrap grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-4">
              <SectionHeading
                id="privacy"
                eyebrow="Privacy"
                title="Private by default."
                lead="Only people you let in can open the gallery. Face search is optional for every attendee and only ever shows them their own photos."
              />
              <div className="flex flex-wrap gap-4">
                <Link href="/privacy" className="kb-link">
                  Read the privacy policy
                </Link>
                <Link href="/faq" className="kb-link">
                  See all questions
                </Link>
              </div>
            </div>
            <Faq items={questions} />
          </div>
        </section>

        <ClosingCta
          title="Ready for your next event?"
          lead="Create the event now and share the link whenever you're ready. Nothing goes out until you publish an album."
          points={[
            "Your logo and colour on every attendee page",
            "Full quality photos and video, originals kept",
            "Gallery open to guests for 12 months",
          ]}
          secondary={inApp ? { href: "/features", label: "See all features" } : { href: "/pricing", label: "See pricing" }}
        />
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NightCta, Photo } from "@/components/site/parts";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "QR Code Photo Sharing: How It Works",
  description: "Set up in about ten minutes. Photographers upload through their own links, and guests scan one QR code and find the photos they're in with a selfie.",
  path: "/how-it-works",
});

const TEAL = "#0e6e66";

const SETUP: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Create the event",
    body: "Give it a name, a date and a venue. It gets one link and one QR code that never change.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    title: "Make it yours",
    body: "Add your logo and colour. Attendees see your brand on the join page, the gallery and the poster.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18" />
        <circle cx="8.5" cy="9" r="1" fill="currentColor" />
        <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      </>
    ),
  },
  {
    title: "Choose who gets in",
    body: "Anyone with the link, or only the people on your guest list. Import a list from Eventbrite, Humanitix, Luma or a spreadsheet.",
    icon: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
      </>
    ),
  },
  {
    title: "Plan the albums",
    body: "One album per part of the event works best: keynote, breakouts, drinks, headshots. Publish each when it's ready, or schedule it.",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
];

const UPLOADING = [
  { title: "Send each photographer a link", body: "Copy it, email it from the app, or let them scan a QR code. Each link uploads into one album until the date you set." },
  { title: "Full resolution, in the background", body: "Photos and videos upload at full quality, and any file that fails can be retried." },
  { title: "Credited by name", body: "Every photo carries the photographer's name, so attendees know who took it." },
];

const FINDING = [
  { title: "Scan and confirm", body: "Attendees scan the code, enter their name and email, and type the code we send. No password to remember." },
  { title: "One selfie, optional", body: "Take a selfie and only that person sees every photo they appear in. Nobody can search for anyone else." },
  { title: "Save and download", body: "Save straight to the phone's photo library, download albums at full quality, or keep favourites for later." },
];

const PRIVACY: { title: string; icon: ReactNode }[] = [
  {
    title: "Email confirmed first",
    icon: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    title: "Face search is opt in",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
  {
    title: "Stored in Sydney",
    icon: (
      <>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
];

function Icon({ children, size = 22, color = "currentColor" }: { children: ReactNode; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function PhaseLabel({ n, children }: { n: string; children: ReactNode }) {
  return (
    <span className="mono text-[14px] text-[color:var(--kb-brand)]">
      Phase {n} · {children}
    </span>
  );
}

/** The organiser's event, summed up in one card. */
function EventCard() {
  return (
    <div aria-hidden className="mt-4 rounded-[14px] bg-[color:var(--kb-sand)] p-5 sm:p-7">
      <div className="flex flex-col gap-3.5 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 shadow-[0_10px_28px_-12px_rgb(22_24_29/0.2)]">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] font-bold text-white" style={{ background: TEAL }}>
            BPS
          </span>
          <span className="flex flex-col leading-[1.3]">
            <span className="font-semibold">Brisbane Product Summit 2026</span>
            <span className="text-[14px] text-[color:var(--kb-ink-3)]">14 to 15 Nov · Brisbane Convention Centre</span>
          </span>
        </span>
        <span className="h-px bg-[color:var(--kb-line)]" />
        {[
          ["Event link", <span key="v" className="mono">events.klubbies.app/e/bps26</span>],
          ["Who can get in", <span key="v" className="font-semibold">Guest list only</span>],
          ["Albums", <span key="v" className="font-semibold">Keynote, Breakouts, Drinks, Headshots</span>],
        ].map(([label, value]) => (
          <span key={label as string} className="flex flex-wrap justify-between gap-x-4 text-[14px]">
            <span className="text-[color:var(--kb-ink-2)]">{label}</span>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A photographer's upload link, open in a browser. */
function UploadWindow() {
  const rows: [string, string, string, number][] = [
    ["sq-5", "DSC_2041.jpg · 24.1 MB", "Done", 100],
    ["sq-6", "DSC_2042.jpg · 22.8 MB", "64%", 64],
    ["sq-7", "DSC_2043.jpg · 25.3 MB", "Waiting", 0],
  ];
  return (
    <div aria-hidden className="overflow-hidden rounded-[14px] border border-[color:var(--kb-line)] bg-white shadow-[0_30px_60px_-30px_rgb(22_24_29/0.35)]">
      <div className="flex h-10 items-center gap-2 border-b border-[color:var(--kb-line)] bg-[color:var(--kb-sand)] px-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[color:var(--kb-line-strong)]" />
        ))}
        <span className="mono ml-4 truncate text-[13px] text-[color:var(--kb-ink-3)]">events.klubbies.app/g/•••••</span>
      </div>
      <div className="flex flex-col gap-[18px] p-5 sm:p-7">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[20px] font-semibold">Upload to Keynote</span>
          <span className="text-[14px] text-[color:var(--kb-ink-2)]">Uploading as Priya Shah</span>
        </span>
        <span className="flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[color:var(--kb-line-input)] text-[15px] text-[color:var(--kb-ink-2)]">
          <Icon size={26} color="var(--kb-brand)">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </Icon>
          Drop photos and videos here
        </span>
        <span className="flex flex-col gap-2.5">
          {rows.map(([photo, file, status, progress]) => (
            <span key={file} className="flex items-center gap-3">
              <Photo name={photo} className="h-10 w-10 flex-none rounded-[6px]" sizes="40px" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="flex justify-between gap-2 text-[14px]">
                  <span className="mono truncate">{file}</span>
                  <span className={progress === 100 ? "font-semibold text-[color:var(--kb-ok)]" : "text-[color:var(--kb-ink-2)]"}>{status}</span>
                </span>
                <span className="relative h-1 overflow-hidden rounded-[2px] bg-[color:var(--kb-line)]">
                  <span className="absolute inset-y-0 left-0" style={{ width: `${progress}%`, background: progress === 100 ? "var(--kb-ok)" : "var(--kb-brand)" }} />
                </span>
              </span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function FindingVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div aria-hidden className="flex h-[300px] items-end justify-center overflow-hidden rounded-[14px] bg-[color:var(--kb-sand)]">
        <div className="flex h-[270px] w-[220px] flex-col gap-2.5 rounded-t-[26px] border-[7px] border-b-0 border-[#05070d] bg-white px-[18px] py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-[9px] text-[13px] font-bold text-white" style={{ background: TEAL }}>
            BPS
          </span>
          <span className="serif text-[22px] leading-[1.1]">Brisbane Product Summit 2026</span>
          {["Your name", "Email"].map((field) => (
            <span key={field} className="flex h-[34px] items-center rounded-[6px] border border-[color:var(--kb-line-input)] px-2.5 text-[13px] text-[color:var(--kb-ink-3)]">
              {field}
            </span>
          ))}
          <span className="flex h-9 items-center justify-center rounded-[6px] bg-[color:var(--kb-ink)] text-[13px] font-semibold text-white">Get my photos</span>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div aria-hidden className="flex h-[300px] items-center justify-center rounded-[14px] bg-[color:var(--kb-sand)]">
        <div className="relative h-[170px] w-[170px]">
          <Photo name="selfie" className="h-[170px] w-[170px] rounded-full" sizes="170px" />
          <span className="absolute -inset-3 rounded-full border-2 border-dashed border-[color:var(--kb-brand)]" />
          <span className="absolute -right-1.5 bottom-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--kb-ok)] text-white shadow-[0_0_0_4px_var(--kb-sand)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden className="flex h-[300px] items-center justify-center rounded-[14px] bg-[color:var(--kb-sand)] p-7">
      <div className="relative grid grid-cols-[repeat(3,72px)] gap-1">
        {/* Download all 23: only photos the sample attendee is in. */}
        {["sq-5", "sq-4", "sq-9", "sq-10", "sq-1", "sq-2"].map((name) => (
          <Photo key={name} name={name} className="h-[72px] w-[72px] rounded-[6px]" sizes="72px" />
        ))}
        <span className="absolute -bottom-[22px] left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[8px] bg-[color:var(--kb-ink)] px-4 py-2.5 text-[14px] font-semibold text-white">
          <Icon size={16}>
            <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
          </Icon>
          Download all 23
        </span>
      </div>
    </div>
  );
}

/** The whole flow on its own page; the home page keeps a three step summary that links here. */
export default async function HowItWorksPage() {
  const inApp = await isNativeAppRequest();

  return (
    <>
      <SiteNav current="how" inApp={inApp} />
      <main>
        <section className="pb-14 pt-12 sm:pb-[72px] sm:pt-24">
          <div className="kb-wrap flex flex-col items-center gap-6 text-center">
            <span className="kb-eyebrow">How it works</span>
            <h1 className="kb-h1 max-w-[22ch] text-balance !text-[68px] !leading-[1.02] max-sm:!text-[44px]">
              How QR code photo sharing works, from setup to every guest&apos;s camera roll.
            </h1>
            <p className="kb-lead m-0 max-w-[56ch]">
              From setting up the event to every attendee holding the photos they&apos;re in: the whole flow, step by step.
            </p>
            <nav aria-label="Phases" className="mt-3 flex flex-wrap justify-center gap-2">
              {[
                ["#before", "01", "Before the event"],
                ["#during", "02", "During the event"],
                ["#after", "03", "After the event"],
              ].map(([href, n, label]) => (
                <a key={href} href={href} className="kb-tab">
                  <span className="mono text-[color:var(--kb-brand)]">{n}</span>
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* Phase 1 */}
        <section id="before" className="scroll-mt-20 border-t border-[color:var(--kb-line)] bg-white py-16 sm:py-24" aria-labelledby="p1">
          <div className="kb-wrap flex flex-wrap items-start gap-16">
            <div className="flex flex-[1_1_360px] flex-col gap-5">
              <PhaseLabel n="01">Before the event</PhaseLabel>
              <h2 id="p1" className="kb-h2 !text-[52px] max-sm:!text-[38px]">
                Set it up once, in about ten minutes.
              </h2>
              <p className="m-0 text-[18px] text-[color:var(--kb-ink-2)]">
                Everything is done in the browser or the iPhone app. Nothing for your guests to install.
              </p>
              <EventCard />
            </div>
            <ol className="m-0 grid flex-[1_1_520px] list-none gap-4 p-0 sm:grid-cols-2">
              {SETUP.map((step) => (
                <li key={step.title} className="flex flex-col gap-3 rounded-[12px] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] p-7">
                  <span className="kb-icon-well">
                    <Icon>{step.icon}</Icon>
                  </span>
                  <h3 className="text-[19px] font-semibold">{step.title}</h3>
                  <p className="kb-body m-0">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Phase 2 */}
        <section id="during" className="scroll-mt-20 border-t border-[color:var(--kb-line)] py-16 sm:py-24" aria-labelledby="p2">
          <div className="kb-wrap flex flex-wrap items-center gap-16">
            <div className="min-w-0 flex-[1_1_520px] max-lg:order-2">
              <UploadWindow />
            </div>
            <div className="flex flex-[1_1_380px] flex-col gap-5">
              <PhaseLabel n="02">During the event</PhaseLabel>
              <h2 id="p2" className="kb-h2 !text-[52px] max-sm:!text-[38px]">
                Photographers upload straight into the right album.
              </h2>
              <p className="m-0 text-[18px] text-[color:var(--kb-ink-2)]">
                Each photographer gets their own upload link. No account, no app, no shared drive.
              </p>
              <ul className="m-0 mt-2 list-none border-t border-[color:var(--kb-line)] p-0">
                {UPLOADING.map((item) => (
                  <li key={item.title} className="flex flex-col gap-1 border-b border-[color:var(--kb-line)] py-[18px]">
                    <span className="text-[17px] font-semibold">{item.title}</span>
                    <span className="text-[color:var(--kb-ink-2)]">{item.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Phase 3 */}
        <section id="after" className="scroll-mt-20 border-t border-[color:var(--kb-line)] bg-white py-16 sm:py-24" aria-labelledby="p3">
          <div className="kb-wrap flex flex-col gap-14">
            <div className="flex max-w-[720px] flex-col gap-5">
              <PhaseLabel n="03">After the event</PhaseLabel>
              <h2 id="p3" className="kb-h2 !text-[52px] max-sm:!text-[38px]">
                Every attendee finds the photos they&apos;re in.
              </h2>
              <p className="m-0 text-[18px] text-[color:var(--kb-ink-2)]">
                Put the QR code on the closing slide, a table card or the follow-up email.
              </p>
            </div>
            <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
              {FINDING.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-5">
                  <FindingVisual step={index} />
                  <div className="flex flex-col gap-2">
                    <span className="mono text-[14px] text-[color:var(--kb-ink-3)]">0{index + 1}</span>
                    <h3 className="text-[21px] font-semibold">{step.title}</h3>
                    <p className="kb-body m-0">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Private by default */}
        <section className="border-t border-[color:var(--kb-line)] py-16 sm:py-24" aria-labelledby="priv">
          <div className="kb-wrap flex flex-wrap items-center gap-12">
            <div className="flex flex-[1_1_420px] flex-col gap-4">
              <span className="kb-eyebrow">Privacy</span>
              <h2 id="priv" className="kb-h2 !text-[52px] max-sm:!text-[38px]">
                Private by default.
              </h2>
              <p className="m-0 text-[18px] text-[color:var(--kb-ink-2)]">
                Only people you let in can open the gallery. Face search is optional for every attendee and only ever
                shows them their own photos. See <a href="/face-search-privacy" className="underline underline-offset-2">how face search works</a>, or{" "}
                <a href="/privacy" className="underline underline-offset-2">read the privacy policy</a>.
              </p>
            </div>
            <div className="grid flex-[1_1_420px] gap-3 sm:grid-cols-3">
              {PRIVACY.map((item) => (
                <div key={item.title} className="kb-tile flex flex-col gap-2 p-5">
                  <Icon color="var(--kb-brand)">{item.icon}</Icon>
                  <span className="font-semibold">{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <NightCta
          title="Ready for your next event?"
          lead="Create the event now and share the link whenever you're ready. Nothing goes out until you publish an album."
          points={[
            "Your logo and colour on every attendee page",
            "Full quality photos and video, originals kept",
            "Gallery open to guests for 12 months",
          ]}
          secondary={{ href: "/features", label: "See all features" }}
        />
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

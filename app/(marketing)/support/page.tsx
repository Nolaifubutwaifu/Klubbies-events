import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContactLine, supportEmail } from "@/components/LegalPage";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { ContactForm } from "./ContactForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Support and Contact",
  description: "Help with sign in codes, photo removal, notifications, billing and deleting your account. Contact Klubbies Events and hear back in two working days.",
  path: "/support",
});

type Topic = { id: string; title: string; short: ReactNode | null; body: ReactNode; icon: ReactNode };

// Also the App Store listing's support URL, so it has to answer the things
// Apple's reviewers look for: how to get help, how to report content, how to
// delete an account. Each topic shows one line and folds open to the rest.
const TOPICS: Topic[] = [
  {
    id: "signin",
    title: "Can't sign in",
    short: "Codes take up to a minute and sometimes land in spam. In guest-list events, use the email you registered with.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
    body: (
      <p>
        Open the event&apos;s link or scan its QR code, then enter your email. If the organiser uses a guest list, use the
        address you registered with; the code only goes to addresses on it. Codes work for ten minutes, so ask for a new
        one if it has expired. Still nothing? Look in your spam folder, then ask the organiser to check your address.
      </p>
    ),
  },
  {
    id: "report",
    title: "Report a photo or a person",
    short: "Open the photo and choose Request removal. It hides straight away while the organiser decides.",
    icon: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
    body: (
      <>
        <p>
          If you&apos;re in a photo you want gone, open it and choose Request removal. It is hidden from attendees straight
          away while the organiser decides, and removed if they haven&apos;t answered within 7 days.
        </p>
        <p>
          For anything else, such as a photo that shouldn&apos;t be there, tell the organiser: they can remove any photo and
          take anyone off the attendee list. If it&apos;s serious or the organiser won&apos;t act, <ContactLine />. We remove
          objectionable content, and the person who posted it where warranted, within 24 hours.
        </p>
      </>
    ),
  },
  {
    id: "notifications",
    title: "Notifications",
    short: "Choose which emails you get from You, under Notifications.",
    icon: (
      <>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
    body: (
      <p>
        In the iPhone app, turn notifications on from your profile. You get one for each kind of email ticked there, so
        unticking New albums stops both. To stop them entirely, turn them off for Klubbies Events in iPhone Settings.
      </p>
    ),
  },
  {
    id: "billing",
    title: "Billing and refunds",
    short: null,
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    body: (
      <>
        <p>
          Receipts are on the event&apos;s Plan screen. See the <Link href="/refunds">refund policy</Link> for when we refund.
        </p>
        <p>
          The app doesn&apos;t sell anything. Organisers pay once per event on the website; refunds are covered in the{" "}
          <Link href="/refunds">refund policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "delete",
    title: "Delete your account",
    short: null,
    icon: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
    body: (
      <>
        <p>
          From You, at the bottom of the page. Your selfies and faceprints go with it. Read the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
        <p>
          Open your profile and choose Delete my account, in the app or on the website. The{" "}
          <Link href="/privacy">privacy policy</Link> explains what that deletes and what stays with the event.
        </p>
      </>
    ),
  },
];

export default async function SupportPage() {
  const inApp = await isNativeAppRequest();
  const hasForm = Boolean(supportEmail());

  return (
    <>
      <SiteNav inApp={inApp} />
      <main>
        <section className="border-b border-[color:var(--kb-line)] pb-14 pt-12 sm:pb-[72px] sm:pt-24">
          <div className="kb-wrap flex flex-col gap-5">
            <span className="kb-eyebrow">Support</span>
            <h1 className="kb-h1 !text-[80px] !leading-none max-sm:!text-[50px]">How can we help?</h1>
            <p className="kb-lead m-0 max-w-[54ch]">
              Most answers are below. For anything else, use the contact form and we&apos;ll reply by email, within two
              working days, and within 24 hours to a report of objectionable content.
            </p>
          </div>
        </section>

        <section className="pb-20 pt-12 sm:pb-28 sm:pt-[72px]">
          <div className="kb-wrap flex flex-wrap items-start gap-16">
            <div className="flex min-w-0 flex-[3_1_520px] flex-col">
              <h2 className="border-b border-[color:var(--kb-ink)] pb-3 text-[24px] font-semibold">Get help</h2>
              {/* Billing stays off the app: Apple allows no pointers to paying elsewhere there. */}
              {TOPICS.filter((topic) => !(inApp && topic.id === "billing")).map((topic) => (
                <details key={topic.id} id={topic.id} className="group scroll-mt-24 border-b border-[color:var(--kb-line)]">
                  <summary className="flex cursor-pointer list-none gap-4 py-[22px] [&::-webkit-details-marker]:hidden">
                    <span className="kb-icon-well" aria-hidden>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        {topic.icon}
                      </svg>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[18px] font-semibold group-hover:text-[color:var(--kb-brand-deep)]">{topic.title}</span>
                      {topic.short ? <span className="text-[color:var(--kb-ink-2)]">{topic.short}</span> : null}
                    </span>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden className="mt-2.5 flex-none transition-transform group-open:rotate-45">
                      <path d="M5 12h14M12 5v14" />
                    </svg>
                  </summary>
                  <div className="flex flex-col gap-3 pb-6 pl-[60px] text-[16px] leading-[1.65] text-[color:var(--kb-ink-2)]">{topic.body}</div>
                </details>
              ))}
            </div>

            <div className="flex-[2_1_380px] rounded-[14px] border border-[color:var(--kb-line)] bg-white p-6 shadow-[0_10px_28px_-12px_rgb(22_24_29/0.12)] sm:p-9">
              <div className="mb-5 flex flex-col gap-1.5">
                <h2 className="text-[24px] font-semibold">Contact us</h2>
                <p className="text-[15px] text-[color:var(--kb-ink-2)]">
                  {hasForm ? "We reply to the email you give us, within two working days." : <>For anything else, <ContactLine />.</>}
                </p>
              </div>
              {hasForm ? <ContactForm /> : null}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter inApp={inApp} />
    </>
  );
}

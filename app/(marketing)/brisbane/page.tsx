import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Event Photo Sharing in Brisbane",
  description: "Photo galleries for Brisbane conferences, Christmas parties and awards nights. Guests find every photo they're in with one selfie. Free up to 50 guests.",
  path: "/brisbane",
});

/*
 * The local page (audit F18). Venues are named as places events happen, never
 * as customers or partners: we have no arrangement with any of them.
 */
export default async function BrisbanePage() {
  const inApp = await isNativeAppRequest();

  const faqs = [
    {
      q: "Is Klubbies Events a Brisbane business?",
      a: "Yes. It is run from Brisbane, Queensland. Photos, attendee details and faceprints are stored in Sydney, Australia.",
    },
    {
      q: "Do you photograph the event?",
      a: "No. Klubbies Events is the gallery: you bring your own photographers, or your venue's, and they upload through their own links.",
    },
    {
      q: "Does it work outside Brisbane?",
      a: "Yes. It works for events anywhere in Australia and New Zealand. Everything is set up online.",
    },
    {
      q: "How fast do you answer questions?",
      a: "Through the contact form on the support page, within two working days, from Brisbane on Australian Eastern Standard Time.",
    },
  ];

  return (
    <ContentPage
      path="/brisbane"
      inApp={inApp}
      eyebrow="Brisbane, Queensland"
      title={
        <>
          Event photo sharing for <em className="kb-accent">Brisbane</em> events.
        </>
      }
      lead="Private photo galleries for conferences, awards nights, uni balls and meetups around Brisbane. Your photographers upload, attendees take one selfie, and each of them gets the photos they're in."
      photos={[
        { name: "sq-10", alt: "Friends at a rooftop party with a city view at sunset" },
        { name: "sq-2", alt: "Group of friends celebrating at a rooftop party" },
        { name: "sq-3", alt: "Group selfie at sunset outdoors" },
        { name: "sq-1", alt: "Group of friends at a rooftop gathering" },
      ]}
      facts={[
        { label: "Run from", title: "Brisbane, QLD", body: "Support in Brisbane time." },
        { label: "Data", title: "Stored in Sydney", body: "Faceprints never leave Australia." },
        { label: "Attendees", title: "No app to install", body: "Any phone or laptop browser." },
        { label: "Setup", title: "About ten minutes", body: "All online, nothing to ship." },
      ]}
      sections={[
        {
          title: "Made in Brisbane, for the events Brisbane runs",
          body: (
            <>
              <p>
                Klubbies Events is run from Brisbane. It started with a familiar problem at local events: hundreds of good
                photos, one shared drive link, and nobody able to find the ones they were in.
              </p>
              <p>It works for the kinds of events this city runs every week:</p>
              <Points
                items={[
                  <>
                    <strong>Conferences and summits</strong> at the convention centre in South Brisbane or a hotel ballroom
                    in the CBD. See <Link href="/conferences">conference photo sharing</Link>.
                  </>,
                  <>
                    <strong>Uni balls, formals and club nights</strong> for clubs at UQ, QUT and Griffith. See{" "}
                    <Link href="/student-clubs">photo sharing for student clubs</Link>.
                  </>,
                  <>
                    <strong>Awards nights and gala dinners</strong>, where every table wants its photo.
                  </>,
                  <>
                    <strong>Meetups, launches and community events</strong> in the Valley, West End or South Bank.
                  </>,
                ]}
              />
            </>
          ),
        },
        {
          title: "How it works on the night",
          body: (
            <>
              <p>
                Before the event, create it online with its name, date, venue, logo and colour, and choose who gets in:
                anyone with the link, or only your guest list. Then send each photographer their upload link.
              </p>
              <p>
                On the night, print the A4 poster for the registration desk or put the QR code on the closing slide.
                Photographers upload at full resolution while the event runs, or afterwards from home. Publish each album
                when it&apos;s ready, and attendees get an email.
              </p>
              <p>
                Attendees scan the code, confirm their email with a code, and take a selfie if they want face search. It
                then shows each of them every photo they&apos;re in. Nobody can search for anyone else.
              </p>
            </>
          ),
        },
        {
          title: "Your data stays in Australia",
          body: (
            <p>
              Photos, attendee details and faceprints are stored in Sydney. A copy of each photo is kept and delivered by
              Cloudflare, which may be outside Australia, but selfies and faceprints are never copied: they stay in
              Sydney. The details are in <Link href="/face-search-privacy">face search and privacy</Link>.
            </p>
          ),
        },
        {
          title: "Talk to someone local",
          body: (
            <p>
              Questions before a big event? <Link href="/support#contact">Use the contact form</Link> and you&apos;ll hear
              back from Brisbane within two working days. Read <Link href="/about">about Klubbies Events</Link> for who
              runs it.
            </p>
          ),
        },
      ]}
      faqs={faqs}
      related={cards("/conferences", "/student-clubs", "/about")}
      cta={{
        title: "Running an event in Brisbane soon?",
        lead: inApp
          ? "Create the event now and share the link whenever you're ready."
          : `Create the event now. It's free for up to ${TIERS.free.guests} guests, and bigger events pay once.`,
        points: ["Your logo and colour on every screen", "Attendees find their own photos", "Gallery open for 12 months"],
        secondary: { href: "/how-it-works", label: "See how it works" },
      }}
    />
  );
}

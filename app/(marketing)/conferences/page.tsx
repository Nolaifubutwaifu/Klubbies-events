import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points, Steps } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Conference Photo Sharing and Event Galleries",
  description: "A private, branded photo gallery for conferences and corporate events in Australia. Delegates scan a QR code, take a selfie and download every photo they're in.",
  path: "/conferences",
});

/** Conferences and corporate events: the revenue lane (docs/handoff-marketing.md, section 2). */
export default async function ConferencesPage() {
  const inApp = await isNativeAppRequest();
  const { free, small, medium, large } = TIERS;

  const faqs = [
    {
      q: "Can we limit the gallery to registered delegates?",
      a: "Yes. Choose guest list only and import the registration export from Eventbrite, Humanitix, Luma or a spreadsheet (CSV, TSV, XLSX or XLS). Only those emails get a sign-in code, and someone who signs in under a name that doesn't match the list waits for your approval.",
    },
    {
      q: "Will our sponsors and speakers see our branding or yours?",
      a: "Yours. Your logo, colour and event name are on the join page, the gallery and the poster. Klubbies Events appears only as a small credit line.",
    },
    {
      q: "Can delegates download the original files?",
      a: "Yes. They download the photographer's original file, one at a time or a whole album at once, from any phone or laptop browser.",
    },
    ...(inApp
      ? []
      : [
          {
            q: "How is a conference priced?",
            a: `By the number of delegates who join the gallery, one payment per event: A$${small.price.standard} for up to ${small.guests}, A$${medium.price.standard} for up to ${medium.guests} and A$${large.price.standard} for up to ${large.guests.toLocaleString("en-AU")}. Up to ${free.guests} is free. For more than ${large.guests.toLocaleString("en-AU")}, ask us for a quote.`,
          },
        ]),
  ];

  return (
    <ContentPage
      path="/conferences"
      inApp={inApp}
      eyebrow="For conferences and corporate events"
      title={
        <>
          Conference photo sharing, with every delegate&apos;s photos <em className="kb-accent">found</em>.
        </>
      }
      lead="A private gallery under your brand. Photographers upload through their own links during the event, and each delegate takes a selfie to find the photos they're in: keynote, breakouts, drinks and headshots."
      facts={[
        { label: "Access", title: "Registered delegates only", body: "Import the list from your ticketing platform." },
        { label: "Brand", title: "Your logo and colour", body: "On the join page, gallery and poster." },
        { label: "Data", title: "Stored in Sydney", body: "Faceprints never leave Australia." },
        { label: "Files", title: "Full quality originals", body: "Photos and video, kept as uploaded." },
      ]}
      sections={[
        {
          title: "Why conference photos usually go unseen",
          body: (
            <>
              <p>
                A two-day conference can produce 3,000 photos. Most organisers post a handful to LinkedIn, send a Dropbox
                link in the wrap-up email, and that&apos;s where the photos stop. Delegates don&apos;t scroll through 3,000
                images to find the one of them on stage, and sponsors never see the shots of their booth.
              </p>
              <p>
                Klubbies Events turns that folder into a gallery each delegate can search for themselves. One selfie, and
                face search shows them every photo they appear in, across every album. It uses facial recognition, and
                it is opt in: only delegates who add their own selfie are matched, and only they see their matches.
              </p>
            </>
          ),
        },
        {
          title: "How it fits a conference run sheet",
          body: (
            <>
              <p>Make one album per part of the program, for example:</p>
              <Points items={["Keynotes", "Breakout sessions", "Expo floor and sponsors", "Networking drinks", "Headshot station"]} />
              <p>
                Each photographer gets an upload link per album, with no account to create. Uploads run in the background
                at full resolution and pick up where they left off if the venue Wi-Fi drops. Every photo is credited to
                the photographer who took it.
              </p>
              <p>
                Publish an album when it&apos;s ready, or schedule it. Delegates get an email each time a new album is
                published, so the keynote photos can go out on day one while the drinks photos are still coming in.
              </p>
            </>
          ),
        },
        {
          title: "Getting delegates in",
          body: (
            <>
              <p>
                Every event has one link and one QR code that never change. The share kit gives you the code as PNG and
                SVG for your slides, a printable A4 poster for the registration desk, and an announcement email you can
                edit for the wrap-up.
              </p>
              <p>
                Delegates scan the code, enter their name and email, and type the 8-digit code we send them. No password
                and no app to install. If you imported a guest list, only registered emails get a code.
              </p>
            </>
          ),
        },
        {
          title: "Privacy your legal team can read",
          body: (
            <>
              <p>
                Photos, attendee details and faceprints are stored in Sydney, Australia. Nothing is public or indexed by
                search engines. Every view and download is logged, so you can see who opened what.
              </p>
              <p>
                Face search can be switched off for the whole event in its settings. When it&apos;s on, every attendee sees
                a notice before any photos, and anyone can ask for a photo to come down: it hides straight away while you
                decide. The full detail is on <Link href="/face-search-privacy">face search and privacy</Link> and in the{" "}
                <Link href="/privacy">privacy policy</Link>.
              </p>
            </>
          ),
        },
        {
          title: "Setup in about ten minutes",
          body: (
            <Steps
              items={[
                "Create the event with its name, dates and venue. Add your logo and brand colour.",
                "Import the delegate list, or leave it open to anyone with the link.",
                "Create the albums and send each photographer their upload links.",
                "Put the QR code on the closing slide and the registration desk poster.",
                "Publish albums as they're ready, and watch joins and downloads per album.",
              ]}
            />
          ),
        },
      ]}
      faqs={faqs}
      related={cards("/guides/share-photos-after-a-conference", "/brisbane", "/photographers")}
      cta={{
        title: "Ready for your next conference?",
        lead: "Create the event now and add the photographers later. Nothing goes out until you publish an album.",
        points: ["Delegate list import", "Your logo and colour on every screen", "Gallery open for 12 months"],
        secondary: { href: inApp ? "/features" : "/pricing", label: inApp ? "See all features" : "See pricing" },
      }}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points, Steps } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Christmas Party Photos for Work Functions",
  description:
    "A private photo gallery for your work Christmas party. Guests scan a QR code, take a selfie and download every photo they're in. Data stored in Sydney.",
  path: "/christmas-parties",
});

/** Work Christmas parties and end-of-year functions: the Nov to Dec business lane (masterdoc, 21 Oct 2026). */
export default async function ChristmasPartiesPage() {
  const inApp = await isNativeAppRequest();
  const { free, small, medium, large } = TIERS;
  const n = (value: number) => value.toLocaleString("en-AU");

  const faqs = [
    {
      q: "Do staff need an app or an account?",
      a: "No. Guests scan the QR code or open the link in their phone's browser, type the 8-digit code we email them, and they're in. There's no password and no app to install.",
    },
    {
      q: "Can we keep the gallery to our staff only?",
      a: "Yes. Import the guest list from Eventbrite, Humanitix, Luma or a spreadsheet, and only those emails get in. Names are checked against the list as well.",
    },
    {
      q: "Can anyone search for photos of a colleague?",
      a: "No. Face search only shows you the photos you're in, and only you see your matches. Nobody can search for another person, not even the organiser.",
    },
    {
      q: "What if someone wants a photo taken down?",
      a: "Anyone can ask for a photo of themselves to come down. It's hidden at once, and the organiser decides within 7 days.",
    },
    {
      q: "How soon can guests see the photos?",
      a: "Albums start as drafts. Once the photographer has uploaded, you publish the album, or schedule an album to go live, so guests can have them the same night. It depends on when your photographer uploads.",
    },
    {
      q: "How long do the photos stay up?",
      a: "The gallery stays open for 12 months. Guests can download the full quality originals to keep.",
    },
    {
      q: "Can we see who has looked at the photos?",
      a: "Yes. Every view, download and zip download is logged, and the event's activity page shows who opened what.",
    },
    {
      q: "Does our photographer need an account?",
      a: "No. You send them their own upload link. They upload in any browser at full quality, failed files can be retried, and every photo is credited to them by name.",
    },
    ...(inApp
      ? []
      : [
          {
            q: "What does it cost, and do guests pay?",
            a: `One payment per event, sized by the guests who join: free up to ${free.guests}, A$${small.price.standard} up to ${small.guests}, A$${medium.price.standard} up to ${medium.guests} and A$${large.price.standard} up to ${n(large.guests)}. Above ${n(large.guests)}, ask us for a quote. Guests never pay.`,
          },
        ]),
  ];

  const sections = [
    {
      title: "Why the shared Drive link doesn't suit a work party",
      body: (
        <>
          <p>
            After most work Christmas parties, the photos go into a shared Google Drive folder and the link goes round in
            an email. Anyone with the link can open it, including people who weren&apos;t there. It carries no brand and
            nobody can search it, so staff scroll through hundreds of photos to find the two they&apos;re in, or message
            the organiser asking for them.
          </p>
          <p>
            Klubbies Events puts the night in a private gallery instead. Each guest takes a selfie, and face search shows
            them every photo they appear in, at full quality, to download.
          </p>
        </>
      ),
    },
    {
      title: "How it works on the night",
      body: (
        <Points
          items={[
            "One link and one QR code for the whole event. Print the A4 QR poster for the entry or the bar, or download the code as PNG or SVG for screens and slides.",
            "Your photographer uploads through their own link, with no account to create. If the venue connection drops, failed files can be retried.",
            "You publish the album, or schedule an album to go live, so guests can have them the same night.",
            "Guests type the 8-digit code we email them, take a selfie and download the photos they're in, from a phone or laptop browser. No app needed.",
            "Publish the album when it's ready, or schedule an album to go live. Guests get an email when a new album is published.",
            "Use the ready-made announcement email the next morning to reach anyone who didn't scan on the night.",
          ]}
        />
      ),
    },
    {
      title: "Privacy at work events",
      body: (
        <>
          <p>Staff photos on a public link is the part HR worries about. Here, nothing is public.</p>
          <Points
            items={[
              "Only confirmed emails get in. Import the guest list from Eventbrite, Humanitix, Luma or a spreadsheet, or use open link mode. Names are checked against the guest list.",
              "Face search is opt in, and only you see your matches. Nobody can search for another person, not even the organiser.",
              "Anyone can ask for a photo of themselves to come down. It's hidden at once, and the organiser decides within 7 days.",
              "Photos, guest details and faceprints are stored in Sydney.",
              "Every view, download and zip download is logged. The event's activity page shows you who opened what.",
            ]}
          />
          <p>
            The detail is on <Link href="/face-search-privacy">face search and privacy</Link>.
          </p>
        </>
      ),
    },
    {
      title: "Your brand, not ours",
      body: (
        <p>
          Your logo, colour and event name are on the join page, the gallery and the QR poster. Klubbies Events appears
          only as a small credit line.
        </p>
      ),
    },
    ...(inApp
      ? []
      : [
          {
            title: "What it costs",
            body: (
              <>
                <p>One payment per event, sized by the number of guests who join. Guests never pay.</p>
                <Points
                  items={[
                    `Free: up to ${free.guests} guests and ${n(free.photos)} photos and videos`,
                    `Small, A$${small.price.standard}: up to ${small.guests} guests and ${n(small.photos)} photos and videos`,
                    `Medium, A$${medium.price.standard}: up to ${medium.guests} guests and ${n(medium.photos)} photos and videos`,
                    `Large, A$${large.price.standard}: up to ${n(large.guests)} guests and ${n(large.photos)} photos and videos`,
                    `More than ${n(large.guests)} guests: ask us for a quote`,
                  ]}
                />
                <p>
                  Every size includes face search, your branding and a gallery open for 12 months. See{" "}
                  <Link href="/pricing">pricing</Link>.
                </p>
              </>
            ),
          },
        ]),
    {
      title: "Set up in about ten minutes",
      body: (
        <>
          <Steps
            items={[
              "Create the event and add your logo and colour.",
              "Import the guest list, or leave it open to anyone with the link who confirms their email.",
              "Send your photographer their upload link.",
              "Put the QR poster up on the night, and send the announcement email the next morning.",
              "Publish the album when it's ready, or schedule an album to go live, and check the activity page to see who has opened it.",
            ]}
          />
          <p>
            Planning a conference for next year too? The same setup works for{" "}
            <Link href="/conferences">conference and corporate event photos</Link>. If your photographer would rather run
            it for you, send them the page for <Link href="/photographers">event photographers</Link>. Based in Queensland? See{" "}
            <Link href="/brisbane">event photo sharing in Brisbane</Link>.
          </p>
        </>
      ),
    },
  ];

  return (
    <ContentPage
      path="/christmas-parties"
      inApp={inApp}
      wideTitle
      eyebrow={<>For Christmas parties and end&#8209;of&#8209;year functions</>}
      title={
        <>
          Work Christmas party photos. Each&nbsp;guest finds theirs with <em className="kb-accent">one selfie</em>.
        </>
      }
      lead="A private gallery under your brand for the end-of-year party. Your photographer uploads through their own link, guests scan the QR code and take a selfie, and each of them finds the photos they're in, at full quality. Nothing is public."
      facts={[
        { label: "Access", title: "Your guests only", body: "Import the guest list, or use an open link." },
        { label: "Brand", title: "Your logo and colour", body: "On the join page, gallery and poster." },
        { label: "Data", title: "Stored in Sydney", body: "Faceprints never leave Sydney." },
        { label: "Files", title: "Full quality originals", body: "Photos and video, as the photographer uploaded them." },
      ]}
      sections={sections}
      faqs={faqs}
      related={cards("/conferences", "/photographers", "/guides/get-event-photos-to-attendees-fast")}
      cta={{
        title: "Running a work Christmas party this year?",
        lead: inApp
          ? "Create the event now and send your photographer the upload link when you're ready."
          : `Create the event now and send your photographer the upload link when you're ready. Up to ${free.guests} guests is free.`,
        points: ["Guest list import", "Your logo and colour on every screen", "Gallery open for 12 months"],
        secondary: { href: inApp ? "/features" : "/pricing", label: inApp ? "See all features" : "See pricing" },
      }}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points, Steps } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Conference and Corporate Event Photos",
  description:
    "Private, branded galleries for conference and corporate event photos. Guests scan a QR code, take a selfie and download every photo they're in.",
  path: "/conferences",
});

/** Conferences, awards nights and work functions (SEO plan, 21 Oct 2026). */
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
    {
      q: "Can we use it for a Christmas party or awards night?",
      a: "Yes. It works the same way for any work function: one link and QR code, photographers upload through their own links, and each guest finds their own photos with a selfie.",
    },
    ...(inApp
      ? []
      : [
          {
            q: "Do guests pay or need an app?",
            a: "No. Guests never pay, and everything works in a phone or laptop browser.",
          },
        ]),
    {
      q: "How soon do guests get their photos?",
      a: "Photos appear in the gallery as the photographer uploads them, so guests can have them the same night.",
    },
    {
      q: "Can someone have a photo of themselves taken down?",
      a: "Yes. It's hidden as soon as they ask, and the organiser decides within 7 days.",
    },
    {
      q: "Can we see who has looked at the photos?",
      a: "Yes. Every view, download and zip download is logged, and the event's activity page shows who opened what.",
    },
  ];

  return (
    <ContentPage
      path="/conferences"
      inApp={inApp}
      wideTitle
      eyebrow="For conferences, awards nights and work functions"
      title={
        <>
          Conference and corporate event <span className="sm:whitespace-nowrap">photo sharing</span>, with every guest&apos;s photos <em className="kb-accent">found</em>.
        </>
      }
      lead="A private gallery under your brand for conferences, awards nights, Christmas parties and other work functions. Photographers upload through their own links as the event runs, and each guest takes a selfie to find the photos they're in, at full quality."
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
                A conference produces hundreds or thousands of photos. Most organisers post a handful to LinkedIn, send a
                Dropbox link in the wrap-up email, and that&apos;s where the photos stop. Delegates don&apos;t scroll
                through the whole folder to find the one of them on stage, and sponsors never see the shots of their
                booth.
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
                Publish an album when it&apos;s ready, or schedule an album to go live. Delegates get an email each time a
                new album is published, so the keynote photos can go out on day one while the drinks photos are still
                coming in.
              </p>
            </>
          ),
        },
        {
          title: "Christmas parties and end-of-year functions",
          body: (
            <p>
              The end-of-year party is where most staff photos get taken, and where a shared Drive link is the worst fit.
              Only confirmed emails get in, face search is opt in, and anyone can ask for a photo of themselves to come
              down. Photos land in the gallery as the photographer uploads them, so guests can have them the same night.
              More on <Link href="/christmas-parties">work Christmas party photos</Link>.
            </p>
          ),
        },
        {
          title: "Awards nights and product launches",
          body: (
            <p>
              Make one album per part of the night: arrivals, presentations, winners, dance floor. Each photographer gets
              their own upload link, and every photo is credited to them by name. Winners find their photos on stage with
              one selfie, at full quality, under your brand rather than ours.
            </p>
          ),
        },
        {
          title: "Who it's for",
          body: (
            <>
              <p>
                Event managers, marketing and HR leads, and the agencies who run events for them, in Brisbane and across
                Australia. See <Link href="/brisbane">event photo sharing in Brisbane</Link>.
              </p>
              {inApp ? null : (
                <p>
                  You pay once per event, sized by the guests who join. Guests never pay. Up to {free.guests} guests and{" "}
                  {free.photos} photos is free. See <Link href="/pricing">pricing</Link>.
                </p>
              )}
            </>
          ),
        },
        {
          title: "Getting delegates in",
          body: (
            <>
              <p>
                Every event has one link and one QR code. The share kit gives you the code as PNG and SVG for your slides,
                a printable A4 poster for the registration desk, and an announcement email you can edit for the wrap-up.
              </p>
              <p>
                Delegates scan the code, enter their name and email, and type the 8-digit code we send them. It works in
                any phone or laptop browser, with no password and no app to install. If you imported a guest list, only
                registered emails get a code.
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
                search engines. Every view, download and zip download is logged, and the event&apos;s activity page shows
                you who opened what.
              </p>
              <p>
                Face search is opt in, and only you see your matches: nobody can search for another person, not even the
                organiser. Anyone can ask for a photo of themselves to come down. It&apos;s hidden at once, and the
                organiser decides within 7 days. The full detail is on <Link href="/face-search-privacy">face search and privacy</Link>{" "}
                and in the <Link href="/privacy">privacy policy</Link>.
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
                "Put the QR code on the closing slide and the A4 poster on the registration desk.",
                "Publish albums as they're ready, or schedule an album to go live, and watch joins and downloads per album on the activity page.",
              ]}
            />
          ),
        },
      ]}
      faqs={faqs}
      related={cards("/christmas-parties", "/photographers", "/guides/share-photos-after-a-conference")}
      cta={{
        title: "Ready for your next event?",
        lead: "Create the event now and add the photographers later.",
        points: ["Guest list import", "Your logo and colour on every screen", "Gallery open for 12 months"],
        secondary: { href: inApp ? "/features" : "/pricing", label: inApp ? "See all features" : "See pricing" },
      }}
    />
  );
}

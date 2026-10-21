import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points, Steps } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Photo Sharing for Uni Balls and Student Clubs",
  description: `Private photo galleries for uni balls, formals and club nights. Members take a selfie and find every photo they're in. Club prices from A$${TIERS.small.price.club} per event.`,
  path: "/student-clubs",
});

/** Uni clubs and societies: the first audience (docs/handoff-marketing.md, section 2). */
export default async function StudentClubsPage() {
  const inApp = await isNativeAppRequest();
  const { free, small, medium, large } = TIERS;

  const faqs = [
    {
      q: "Do members need to download an app?",
      a: "No. Members scan the QR code and the gallery opens in their phone's browser. There is an iPhone app for anyone who prefers it.",
    },
    {
      q: "Can only our members see the photos?",
      a: "If you choose guest list only, yes: only the emails on your list get a sign-in code. Import the list from Humanitix, Eventbrite or a spreadsheet. Someone who signs in under a name that doesn't match the list waits for you to approve them.",
    },
    ...(inApp
      ? []
      : [
          {
            q: "How do club prices work?",
            a: `Clubs pay less with their campus club code: A$${small.price.club} for up to ${small.guests} guests, A$${medium.price.club} for up to ${medium.guests} and A$${large.price.club} for up to ${large.guests.toLocaleString("en-AU")}, one payment per event. Ask us for your campus code through the contact form, and we'll check the club is listed with your student union. Events up to ${free.guests} guests are free.`,
          },
        ]),
    {
      q: "What if someone wants a photo taken down?",
      a: "They open the photo and choose Request removal. It is hidden from everyone straight away, and an exec decides whether it stays down. If nobody answers within 7 days, it stays down.",
    },
  ];

  return (
    <ContentPage
      path="/student-clubs"
      inApp={inApp}
      eyebrow="For student clubs"
      title={
        <>
          Photo sharing for uni balls and <em className="kb-accent">club nights</em>.
        </>
      }
      lead="A private photo gallery for uni balls, formals, cocktail nights and sports nights. Your photographers upload, members take one selfie, and everyone gets the photos they're in."
      photos={[
        { name: "sq-9", alt: "Group of friends celebrating together outdoors at a party" },
        { name: "sq-5", alt: "Group of friends enjoying a rooftop party" },
        { name: "sq-4", alt: "Friends taking a selfie together on a rooftop" },
        { name: "sq-10", alt: "Friends at a rooftop party with a city view behind them" },
      ]}
      facts={[
        { label: "Members", title: "No app needed", body: "The gallery opens in any phone browser." },
        { label: "Photographers", title: "No account needed", body: "Each one gets their own upload link." },
        inApp
          ? { label: "Access", title: "Members only", body: "Guest list mode lets in only your list." }
          : { label: "Price", title: `Club prices from A$${small.price.club}`, body: `Free up to ${free.guests} guests.` },
        { label: "Gallery", title: "Open for 12 months", body: "Long enough for next year's recap post." },
      ]}
      sections={[
        {
          title: "The problem with the Drive folder",
          body: (
            <>
              <p>
                After a ball, the photographer sends a Google Drive link with 1,500 photos. It goes in the group chat, gets
                forwarded to people who weren&apos;t there, and members scroll for twenty minutes looking for themselves.
                Then the DMs start: &quot;are there any of me?&quot;
              </p>
              <p>
                Klubbies Events replaces that link. Members scan a QR code, confirm their email with a code, and take a
                selfie if they want to. Face search, the facial recognition they opt in to, then shows each of them the
                photos they&apos;re in, across every album. Nobody else can search for them.
              </p>
            </>
          ),
        },
        {
          title: "Built for the events clubs actually run",
          body: (
            <>
              <p>One event can hold as many albums as the night needs. A ball might look like this:</p>
              <Points
                items={[
                  "Arrivals and the photo wall",
                  "Dinner and speeches",
                  "Dance floor",
                  "Photo booth or a second photographer",
                ]}
              />
              <p>
                Each photographer gets their own upload link for their album, so a volunteer with a phone and a hired
                photographer with a full-frame camera both upload into the right place. Photos stay at full resolution,
                and every one is credited to the person who took it.
              </p>
            </>
          ),
        },
        {
          title: "Private by default, which matters at uni",
          body: (
            <>
              <p>
                Nothing in the gallery is public or indexed by search engines. Every view and download is tied to a
                confirmed email. For members-only events, switch to guest list only and import your ticket list from
                Humanitix, Eventbrite or a spreadsheet: only those emails can get in.
              </p>
              <p>
                Anyone can ask for a photo of themselves to come down. It hides at once while an exec decides. Read{" "}
                <Link href="/face-search-privacy">how face search and consent work</Link> before your event if your
                committee wants the details.
              </p>
            </>
          ),
        },
        {
          title: "Setting it up for your next event",
          body: (
            <Steps
              items={[
                "Create the event with its name, date and venue, then add your club's logo and colour.",
                "Choose who gets in: anyone with the link, or only your ticket list.",
                "Make an album for each part of the night and send each photographer their upload link.",
                "Put the QR code on the photo wall, the table cards or the last slide of the speeches.",
                "Publish each album when it's ready. Members get an email when new photos land.",
              ]}
            />
          ),
        },
        ...(inApp
          ? []
          : [
              {
                title: "What it costs a club",
                body: (
                  <>
                    <p>
                      One payment per event, no subscription. Events with up to {free.guests} guests are free. With your
                      campus club code, bigger events cost A${small.price.club} for up to {small.guests} guests, A$
                      {medium.price.club} for up to {medium.guests} and A${large.price.club} for up to{" "}
                      {large.guests.toLocaleString("en-AU")}. A {medium.guests}-guest ball at A${medium.price.club} works
                      out at about 15 cents a guest.
                    </p>
                    <p>
                      To get your code, <Link href="/support#contact">ask us through the contact form</Link> with your
                      club&apos;s name and uni. We check the club is listed with your student union, then send it. See{" "}
                      <Link href="/pricing">pricing</Link> for every size.
                    </p>
                  </>
                ),
              },
            ]),
      ]}
      faqs={faqs}
      related={cards("/photographers", "/face-search-privacy", "/guides/get-event-photos-to-attendees-fast")}
      cta={{
        title: "Set up your next event tonight.",
        lead: "It takes about ten minutes. Nothing goes out to members until you publish an album.",
        points: ["Your club's logo and colour", "Members find their own photos", "Full quality downloads"],
        secondary: { href: "/features", label: "See all features" },
      }}
    />
  );
}

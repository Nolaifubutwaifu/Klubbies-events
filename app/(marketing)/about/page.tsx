import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points } from "@/components/site/ContentPage";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About: Brisbane Event Photo Galleries",
  description: "Klubbies Events is a Brisbane-run private event photo service. Who runs it, why it exists, and how attendee photos and faceprints are protected.",
  path: "/about",
});

/*
 * Who is behind the site (audit F19). First name only, and the contact form
 * rather than an address: the support email stays off the site
 * (docs/decisions.md, 109). No customer quotes until real ones exist.
 */
export default async function AboutPage() {
  const inApp = await isNativeAppRequest();

  return (
    <ContentPage
      path="/about"
      inApp={inApp}
      eyebrow="About"
      title={
        <>
          Event photos should reach the people <em className="kb-accent">in</em> them.
        </>
      }
      lead="Klubbies Events is a private photo gallery for events, run from Brisbane, Queensland. It exists so that every attendee leaves with the photos they're in, without a shared drive link or a single photo being public."
      facts={[
        { label: "Based in", title: "Brisbane, QLD", body: "Run and supported from Brisbane." },
        { label: "Data", title: "Stored in Sydney", body: "Photos, attendee details and faceprints." },
        { label: "Since", title: "2026", body: "Built for events in Australia and New Zealand." },
        { label: "Contact", title: "Contact form", body: "A reply within two working days." },
      ]}
      sections={[
        {
          title: "Why it exists",
          body: (
            <>
              <p>
                Klubbies Events is run by Max, a photographer and videographer in Brisbane. After enough events, the
                pattern was always the same. Hundreds of good photos went into one shared folder, the link was forwarded
                around, and most people never found the photos they were in. The ones who tried sent messages asking for
                them.
              </p>
              <p>
                The fix is simple to describe: give every event a private gallery, let each attendee find their own photos
                with one selfie, and keep everything out of public view. Klubbies Events is that fix.
              </p>
            </>
          ),
        },
        {
          title: "What we believe about event photos",
          body: (
            <Points
              items={[
                "Photos of people belong with those people, at full quality, not compressed in a group chat.",
                "Nothing from a private event should be public or findable in search engines.",
                "Face search should only ever help someone find themselves. Nobody, organiser included, can search for another person.",
                "Anyone in a photo should be able to ask for it to come down, and it should disappear at once while that's decided.",
                "Organisers and their photographers should get the credit, not us: the gallery carries their brand and the photographer's name.",
              ]}
            />
          ),
        },
        {
          title: "How photos and faces are protected",
          body: (
            <>
              <p>
                Photos, attendee details and faceprints are stored in Sydney, Australia. Every view and download is tied to
                a confirmed email and logged. Face search is opt in for every attendee, and turning it off deletes their
                selfie, faceprint and matches within 24 hours.
              </p>
              <p>
                The plain-words version is on <Link href="/face-search-privacy">face search and privacy</Link>, and the full
                version is the <Link href="/privacy">privacy policy</Link>.
              </p>
            </>
          ),
        },
        {
          title: "Who it's for",
          body: (
            <p>
              Uni clubs running balls and formals, organisers of conferences and corporate events, and the photographers
              who shoot them. Read more for <Link href="/student-clubs">student clubs</Link>,{" "}
              <Link href="/conferences">conferences</Link> and <Link href="/photographers">photographers</Link>.
            </p>
          ),
        },
        {
          title: "Get in touch",
          body: (
            <p>
              Questions, feedback or a large event to plan? <Link href="/support#contact">Use the contact form</Link> and
              you&apos;ll get a reply by email within two working days.
            </p>
          ),
        },
      ]}
      related={cards("/face-search-privacy", "/brisbane", "/student-clubs")}
      cta={{
        title: "Try it on your next event.",
        lead: "Create the event in about ten minutes. Nothing goes out until you publish an album.",
        points: ["Private by default", "Attendees find their own photos", "Stored in Sydney"],
        secondary: { href: "/how-it-works", label: "See how it works" },
      }}
    />
  );
}

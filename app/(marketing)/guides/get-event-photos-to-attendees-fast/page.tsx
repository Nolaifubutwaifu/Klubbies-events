import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points, Steps } from "@/components/site/ContentPage";
import { cards, GUIDES_PUBLISHED, PAGE_CARDS } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

const PATH = "/guides/get-event-photos-to-attendees-fast";
const DESCRIPTION = "How to get event photos to attendees the same night: upload during the event, cull lightly, publish album by album and tell guests where to look.";

export const metadata: Metadata = pageMetadata({ title: PAGE_CARDS[PATH].title, description: DESCRIPTION, path: PATH });

export default async function FastDeliveryGuide() {
  const inApp = await isNativeAppRequest();

  return (
    <ContentPage
      path={PATH}
      inApp={inApp}
      article={{ headline: PAGE_CARDS[PATH].title, description: DESCRIPTION, published: GUIDES_PUBLISHED }}
      eyebrow="Guide"
      title={PAGE_CARDS[PATH].title}
      lead="Photos get the most attention while the event is still fresh. Delivered the same night, they end up on people's profiles with the event's name on them. Delivered a fortnight later, most go unseen."
      sections={[
        {
          title: "Why speed matters",
          body: (
            <p>
              The morning after an event, guests are looking for photos to post. If yours aren&apos;t there, they post their
              own phone photos instead, and the good ones from your photographer arrive after everyone has moved on. For a
              club, the post-event photos are next year&apos;s recruitment material. For a conference, they are the
              sponsors&apos; proof. Both are worth more early.
            </p>
          ),
        },
        {
          title: "Plan for two rounds, not one",
          body: (
            <>
              <p>The trick is to stop treating delivery as one big drop at the end.</p>
              <Points
                items={[
                  <>
                    <strong>Round one, on the night:</strong> a light cull of the best photos from the first part of the
                    event, uploaded while the event is still running.
                  </>,
                  <>
                    <strong>Round two, within a few days:</strong> the full, edited set, album by album.
                  </>,
                ]}
              />
              <p>
                Agree on this with the photographer before the event. Same-night photos with minimal editing are a
                different job from a polished set a week later, and it should be in the brief and the quote.
              </p>
            </>
          ),
        },
        {
          title: "Set up so the photographer can upload from the venue",
          body: (
            <>
              <Steps
                items={[
                  "Make one album per part of the event: arrivals, speeches, dance floor.",
                  "Give each photographer their own upload destination for each album, so nobody sorts photos later.",
                  "Check the venue Wi-Fi or plan for a phone hotspot, and use an upload tool that resumes after a dropped connection.",
                  "Have the photographer shoot JPEG alongside RAW, or set up a quick export preset, so the first upload doesn't wait for a full edit.",
                ]}
              />
              <p>
                In Klubbies Events, each photographer gets an upload link per album that works in any browser, with no
                account. Uploads run in the background at full resolution and resume if the connection drops, so a laptop
                in the corner of the venue can upload while the photographer keeps shooting.
              </p>
            </>
          ),
        },
        {
          title: "Publish album by album",
          body: (
            <p>
              Don&apos;t wait for every album to be ready. Publish the arrivals album as soon as it&apos;s uploaded and
              checked, then the next. Attendees who have joined the gallery get an email each time a new album is
              published, so each round brings people back.
            </p>
          ),
        },
        {
          title: "Tell guests where to look, before they leave",
          body: (
            <>
              <p>Guests can only find photos fast if they know where to go. Before the night ends:</p>
              <Points
                items={[
                  "Put the QR code on the table cards, the photo wall or the screen during speeches.",
                  "Ask the MC to mention it once: scan this, take a selfie, and you'll get every photo you're in.",
                  "Post the link in the event's group chat or channel at the end of the night.",
                ]}
              />
              <p>
                Guests who scan on the night and confirm their email are already in the gallery when the first album goes
                out, and get the email straight away.
              </p>
            </>
          ),
        },
        {
          title: "Let people find themselves",
          body: (
            <p>
              Fast delivery doesn&apos;t help if guests then scroll through 800 photos. With face search, each guest takes
              one selfie and sees only the photos they&apos;re in, across every album, including ones published later. It
              is opt in for every guest, and nobody can search for anyone else. See{" "}
              <Link href="/face-search-privacy">how face search works</Link>.
            </p>
          ),
        },
        {
          title: "The same-night checklist",
          body: (
            <Steps
              items={[
                "Agree on a same-night round with the photographer, in writing.",
                "Create the event and one album per part of the night.",
                "Send each photographer their upload links before the event.",
                "Put the QR code where guests will see it on the night.",
                "Upload and publish the first album before the event ends.",
                "Publish the full edited set within a few days.",
              ]}
            />
          ),
        },
      ]}
      related={cards("/photographers", "/student-clubs", "/guides/share-photos-after-a-conference")}
      cta={{
        title: "Get the photos out tonight.",
        lead: "Create the event, send the upload links, and publish each album as it lands.",
        points: ["Upload links for each photographer", "Albums publish one at a time", "Guests emailed when photos land"],
        secondary: { href: "/how-it-works", label: "See how it works" },
      }}
    />
  );
}

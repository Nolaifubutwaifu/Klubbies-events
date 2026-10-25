import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points, Steps } from "@/components/site/ContentPage";
import { cards, GUIDES_PUBLISHED, PAGE_CARDS } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

const PATH = "/guides/share-photos-after-a-conference";
const DESCRIPTION = "A plan for sharing conference photos with delegates, before the event, on the day and in the follow-up email, so photos get seen, not left in a folder.";

export const metadata: Metadata = pageMetadata({ title: PAGE_CARDS[PATH].title, description: DESCRIPTION, path: PATH });

export default async function ShareConferencePhotosGuide() {
  const inApp = await isNativeAppRequest();

  return (
    <ContentPage
      path={PATH}
      inApp={inApp}
      article={{ headline: PAGE_CARDS[PATH].title, description: DESCRIPTION, published: GUIDES_PUBLISHED }}
      eyebrow="Guide"
      title={PAGE_CARDS[PATH].title}
      lead="Most conference photos are seen by a handful of people. With a little planning before the day, every delegate can find the photos they're in within a day or two of the closing keynote."
      sections={[
        {
          title: "Decide where the photos will live before the event",
          body: (
            <>
              <p>
                The worst time to choose how to share photos is the evening after the event, when the photographer has
                already uploaded 3,000 files to a drive. Decide in the planning stage, and put it in the photographer&apos;s
                brief. Answer three questions:
              </p>
              <Points
                items={[
                  "Who should be able to see the photos: every delegate, only registered delegates, or the public?",
                  "How will delegates find themselves among thousands of photos?",
                  "How quickly do you need photos out: during the event, the next day or the next week?",
                ]}
              />
              <p>
                For most conferences the answer is: registered delegates only, findable by person, and the first album
                within 24 hours. A shared folder handles the first answer badly and the second not at all. Read{" "}
                <Link href="/guides/google-drive-vs-private-event-gallery">Google Drive vs a private event gallery</Link>{" "}
                for the trade-offs.
              </p>
            </>
          ),
        },
        {
          title: "Split the program into albums",
          body: (
            <>
              <p>
                One folder of 3,000 photos is hard to browse. Albums that follow the run sheet are easy, and they let you
                publish in stages. A typical split:
              </p>
              <Points items={["Keynotes and plenary sessions", "Breakouts and workshops", "Expo floor and sponsor booths", "Networking drinks or the dinner", "Headshot station"]} />
              <p>
                Give each photographer a clear area to cover, and an upload destination for each album. If sponsors paid
                for coverage, make their booth an album of its own so you can send it to them directly.
              </p>
            </>
          ),
        },
        {
          title: "Brief the photographers",
          body: (
            <>
              <p>A short written brief saves hours later. Include:</p>
              <Steps
                items={[
                  "Which sessions and areas each photographer covers, and the album each set goes into.",
                  "When you need the first upload: for example the keynote photos by 9 am the next day.",
                  "The format: full resolution JPEG, edited, with blinks and duplicates removed.",
                  "Who to tell if someone asks not to be photographed, and how to mark those photos.",
                ]}
              />
            </>
          ),
        },
        {
          title: "Tell delegates on the day",
          body: (
            <>
              <p>
                Delegates are most likely to look for photos while the event is still on their mind. Tell them where the
                photos will be, more than once:
              </p>
              <Points
                items={[
                  "A QR code on the registration desk and on the screen between sessions.",
                  "A line from the MC in the closing remarks: scan this to find every photo you're in.",
                  "The same QR code on the last slide of the closing keynote.",
                ]}
              />
              <p>
                It helps to say that the gallery is private, and how anyone can ask for a photo to be taken down. People
                relax in front of the camera when they know where the photos will end up.
              </p>
            </>
          ),
        },
        {
          title: "Publish in stages, then send the follow-up",
          body: (
            <>
              <p>
                Publish the keynote album as soon as it&apos;s ready, even if the rest are still being edited. A first
                album the next morning gets far more views than a complete set a week later. Publish the others as they
                arrive.
              </p>
              <p>
                Then put the gallery link at the top of the wrap-up email, above the survey and the slides. Delegates open
                the wrap-up email for the photos, not the survey.
              </p>
            </>
          ),
        },
        {
          title: "Let each delegate find themselves",
          body: (
            <>
              <p>
                The step most conferences skip is the one that decides whether photos get used. If delegates have to
                scroll, most won&apos;t. If they can take a selfie and see only the photos they&apos;re in, most will
                download at least one.
              </p>
              <p>
                That is what <Link href="/conferences">Klubbies Events does for conferences</Link>: a private gallery under
                your brand, upload links for each photographer, and face search so each delegate finds their own photos.
                Face search is opt in, and nobody can search for another person. See{" "}
                <Link href="/face-search-privacy">how it handles consent</Link>.
              </p>
            </>
          ),
        },
        {
          title: "A checklist to copy",
          body: (
            <Steps
              items={[
                "Choose the gallery and who can get in, at the planning stage.",
                "Create an album for each part of the program.",
                "Send each photographer a brief and their upload destination.",
                "Print the QR code for the registration desk and add it to the closing slide.",
                "Publish the first album within 24 hours.",
                "Lead the wrap-up email with the gallery link.",
              ]}
            />
          ),
        },
      ]}
      related={cards("/conferences", "/guides/get-event-photos-to-attendees-fast", "/guides/google-drive-vs-private-event-gallery")}
      cta={{
        title: "Set up your conference gallery.",
        lead: "Create the event now and add the photographers when the program is final.",
        points: ["An album for each session", "Delegate list import", "Face search, opt in"],
        secondary: { href: "/conferences", label: "For conferences" },
      }}
    />
  );
}

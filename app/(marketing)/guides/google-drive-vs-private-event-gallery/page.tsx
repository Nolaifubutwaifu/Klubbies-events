import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards, GUIDES_PUBLISHED, PAGE_CARDS } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

const PATH = "/guides/google-drive-vs-private-event-gallery";
const DESCRIPTION = "Sharing event photos through a Google Drive folder or a private event gallery, compared on privacy, finding yourself, quality, branding and cost.";

export const metadata: Metadata = pageMetadata({ title: PAGE_CARDS[PATH].title, description: DESCRIPTION, path: PATH });

/*
 * Fair to Drive on purpose: it is free and familiar, and for a small event it
 * is often enough. Claims about Drive are limited to how link sharing and
 * folders work for everyone.
 */
const COMPARISON: [string, string, string][] = [
  ["Who can open it", "Anyone with the link, or emails added by hand", "Confirmed emails, or your guest list only"],
  ["Finding your photos", "Scroll through everything", "One selfie, opt in"],
  ["Removal requests", "By message, visible until handled", "Hidden at once, organiser decides"],
  ["Branding", "None", "Your logo and colour"],
  ["Photographer credit", "Only if files are renamed", "Every photo, by name"],
  ["Who looked", "Not easily", "Joins and downloads per album"],
];

export default async function DriveVsGalleryGuide() {
  const inApp = await isNativeAppRequest();

  return (
    <ContentPage
      path={PATH}
      inApp={inApp}
      article={{ headline: PAGE_CARDS[PATH].title, description: DESCRIPTION, published: GUIDES_PUBLISHED }}
      eyebrow="Guide"
      title={PAGE_CARDS[PATH].title}
      lead="A shared Google Drive folder is the default way to hand out event photos. It's free and everyone knows it. Here's what it does well, where it falls short for events, and when a private gallery is worth it."
      sections={[
        {
          title: "What a shared folder does well",
          body: (
            <Points
              items={[
                "It costs nothing extra if you already have the storage.",
                "Everyone knows how to open a Drive link.",
                "Photographers can upload full resolution files, and people can download them.",
                "For a small event, say 30 friends and 150 photos, scrolling through everything is fine.",
              ]}
            />
          ),
        },
        {
          title: "Where it falls short for events",
          body: (
            <>
              <p>The problems grow with the size of the event.</p>
              <Points
                items={[
                  <>
                    <strong>Finding yourself.</strong> A folder has no idea who is in each photo. With 1,500 photos,
                    attendees scroll, give up, or message the organiser asking for the ones of them.
                  </>,
                  <>
                    <strong>Who can see it.</strong> &quot;Anyone with the link&quot; means anyone the link reaches. It gets
                    forwarded to group chats and posted in places you didn&apos;t plan for. Restricting it to named people
                    means adding every email by hand.
                  </>,
                  <>
                    <strong>Taking a photo down.</strong> If someone is unhappy with a photo, they have to find the right
                    person to ask, and it stays visible until that person acts.
                  </>,
                  <>
                    <strong>Branding and credit.</strong> The folder shows file names, not your event. Photographers
                    aren&apos;t credited unless they rename every file.
                  </>,
                  <>
                    <strong>Knowing if anyone looked.</strong> You can&apos;t easily tell how many attendees found photos
                    of themselves, which matters if you report back to sponsors or a committee.
                  </>,
                ]}
              />
            </>
          ),
        },
        {
          title: "What a private event gallery changes",
          body: (
            <>
              <p>
                A gallery built for events starts from the attendee&apos;s question: which photos am I in? In Klubbies
                Events, that works like this:
              </p>
              <Points
                items={[
                  "Attendees confirm their email with a code before they see anything. In guest-list mode, only your list can get in.",
                  "Each attendee can take a selfie, and face search shows them only the photos they're in. Nobody can search for anyone else.",
                  "Photographers upload through their own links, straight into albums, credited by name.",
                  "Anyone can ask for a photo to come down. It hides at once while the organiser decides.",
                  "Your logo and colour are on every attendee screen, and you can see joins and downloads per album.",
                ]}
              />
            </>
          ),
        },
        {
          title: "Side by side",
          body: (
            <>
              {/* A table from 640px; stacked pairs on a phone, where three columns don't fit. */}
              <table className="kb-table hidden w-full text-[15px] sm:table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Compared</span>
                    </th>
                    <th scope="col">Shared Drive folder</th>
                    <th scope="col">Private event gallery</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([label, drive, gallery]) => (
                    <tr key={label}>
                      <th scope="row" className="text-left font-semibold">
                        {label}
                      </th>
                      <td>{drive}</td>
                      <td>{gallery}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="m-0 flex flex-col gap-3 sm:hidden">
                {COMPARISON.map(([label, drive, gallery]) => (
                  <div key={label} className="kb-tile flex flex-col gap-2 p-4 text-[15px]">
                    <dt className="font-semibold text-[color:var(--kb-ink)]">{label}</dt>
                    <dd className="m-0">
                      <span className="font-medium text-[color:var(--kb-ink)]">Drive folder:</span> {drive}
                    </dd>
                    <dd className="m-0">
                      <span className="font-medium text-[color:var(--kb-ink)]">Private gallery:</span> {gallery}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ),
        },
        {
          title: "Which to use",
          body: (
            <>
              <p>
                Use a shared folder when the event is small, everyone knows each other, and nobody minds the link being
                forwarded. It&apos;s quick and it works.
              </p>
              <p>
                Use a private gallery when the event has more than a few dozen guests, when people expect privacy (a
                corporate event, a uni ball, anything with clients present), or when you want people to actually
                find and download their photos.
              </p>
              {inApp ? null : (
                <p>
                  Klubbies Events is free for up to {TIERS.free.guests} guests and {TIERS.free.photos} photos, so you can
                  try both on a small event. Bigger events pay once, from A${TIERS.small.price.standard}. See{" "}
                  <Link href="/pricing">pricing</Link>.
                </p>
              )}
            </>
          ),
        },
      ]}
      related={cards("/guides/share-photos-after-a-conference", "/face-search-privacy", "/student-clubs")}
      cta={{
        title: "Your next event deserves better than a shared drive link.",
        lead: "Create the event in about ten minutes and send the photographers their links.",
        points: ["Private by default", "Attendees find their own photos", "Full quality downloads"],
        secondary: { href: "/features", label: "See all features" },
      }}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points } from "@/components/site/ContentPage";
import { cards } from "@/lib/copy/pages";
import { UPLOAD_MAX_MB } from "@/lib/media/constants";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Event Photo Delivery for Photographers",
  description: "Deliver event photos to every attendee without a shared drive. Upload full resolution through your own link, credited by name, and each guest finds their own photos.",
  path: "/photographers",
});

/** Event and portrait photographers: the channel (docs/handoff-marketing.md, section 2). */
export default async function PhotographersPage() {
  const inApp = await isNativeAppRequest();

  const faqs = [
    {
      q: "Do I need an account to upload?",
      a: "No. The organiser creates an upload link for you and sends it. It works in any browser and stops working on the date they choose.",
    },
    {
      q: "Are my photos compressed?",
      a: "No. The original file you upload is what attendees download. Smaller preview copies are made for browsing the gallery.",
    },
    {
      q: "Can I upload video?",
      a: `Yes. Each video file can be up to ${UPLOAD_MAX_MB} MB, and it uploads into the same album as your photos.`,
    },
    {
      q: "Can I run the event gallery myself?",
      a: "Yes. A photographer can create the event as its organiser, add the client's logo and colour, and share the QR code with the client to pass on to guests.",
    },
  ];

  return (
    <ContentPage
      path="/photographers"
      inApp={inApp}
      eyebrow="For event photographers"
      title={
        <>
          Event photo delivery that gets every photo to its <em className="kb-accent">people</em>.
        </>
      }
      lead="Upload full resolution through your own link, straight into the right album, credited by name. Every guest takes a selfie and finds the photos they're in, so your work gets seen and downloaded instead of sitting in a folder."
      photos={[
        { name: "sq-6", alt: "Event photo of friends at a rooftop party in summer" },
        { name: "sq-7", alt: "Candid photo of friends having fun at a rooftop party" },
        { name: "sq-8", alt: "Group of friends photographed at a rooftop party" },
        { name: "cover-drinks", alt: "Friends enjoying a rooftop party with music" },
      ]}
      sections={[
        {
          title: "The delivery problem every event photographer knows",
          body: (
            <>
              <p>
                You shoot 1,200 frames, cull to 600, edit, export and upload to a shared drive. The client forwards the
                link. Then guests message you directly, asking for the three photos they&apos;re in, or screenshot your
                work at low resolution and post it without credit.
              </p>
              <p>
                Klubbies Events changes the last step. Each guest opens the event&apos;s private gallery, takes a selfie,
                and face search shows them the photos they&apos;re in. They download your original file, with your name on
                it in the gallery.
              </p>
            </>
          ),
        },
        {
          title: "Uploading through your own link",
          body: (
            <>
              <p>
                The organiser makes one upload link per photographer, per album, and sends it to you. Open it in any
                browser, on a laptop at the venue or at home after the edit, and drop in your photos and videos.
              </p>
              <Points
                items={[
                  "No account to create and no app to install.",
                  "Full resolution, kept exactly as you uploaded it.",
                  "Uploads run in the background and resume if the connection drops.",
                  "Each photo is credited to you by name, so guests know who took it.",
                  `Videos up to ${UPLOAD_MAX_MB} MB per file, in the same album.`,
                ]}
              />
            </>
          ),
        },
        {
          title: "Working with second shooters and volunteers",
          body: (
            <p>
              Every photographer gets their own link, so a second shooter on the dance floor and a volunteer at the photo
              booth upload into their own albums at the same time. The organiser sees who sent what, and guests see every
              photo credited to the right person.
            </p>
          ),
        },
        {
          title: "Offering it to your clients",
          body: (
            <>
              <p>
                You can set up the gallery yourself: create the event as its organiser, add the client&apos;s logo and
                colour, and hand them the QR code and printable poster to share with guests. It becomes part of what you
                deliver, rather than one more link in an email.
              </p>
              <p>
                Guests can ask for a photo of themselves to come down. It hides at once while the organiser decides, which
                saves you the awkward email. See <Link href="/face-search-privacy">how face search and consent work</Link>{" "}
                if your clients ask.
              </p>
              <p>
                If you photograph a lot of events and want to talk about a referral arrangement for your clients,{" "}
                <Link href="/support#contact">get in touch</Link>.
              </p>
            </>
          ),
        },
      ]}
      faqs={faqs}
      related={cards("/guides/get-event-photos-to-attendees-fast", "/guides/google-drive-vs-private-event-gallery", "/student-clubs")}
      cta={{
        title: "Deliver your next event this way.",
        lead: "Set the event up for a client, or send this page to the organiser and ask for an upload link.",
        points: ["Full resolution, credited by name", "No account needed to upload", "Guests find their own photos"],
        secondary: { href: "/how-it-works", label: "See how it works" },
      }}
    />
  );
}

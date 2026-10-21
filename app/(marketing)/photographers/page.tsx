import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points } from "@/components/site/ContentPage";
import { TIERS } from "@/lib/billing/plans";
import { cards } from "@/lib/copy/pages";
import { UPLOAD_MAX_MB } from "@/lib/media/constants";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Photo Delivery for Event Photographers",
  description:
    "Get conference, awards night and Christmas party photos to every guest. Upload full resolution through your own link, credited by name. No shared drive.",
  path: "/photographers",
});

/** Event photographers delivering corporate and work-function photos (SEO plan, 21 Oct 2026). */
export default async function PhotographersPage() {
  const inApp = await isNativeAppRequest();
  const { free, small, medium, large } = TIERS;

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
    {
      q: "Is it private enough for corporate clients?",
      a: "Yes. Galleries are private by default, only confirmed emails get in, face search is opt in, only each guest sees their own matches, and data is stored in Sydney.",
    },
    {
      q: "Can I upload during the event?",
      a: "Yes. Uploads appear in the gallery as they land, and they resume if the venue connection drops.",
    },
    ...(inApp
      ? []
      : [
          {
            q: "What does my client pay?",
            a: `One payment per event, sized by the guests who join: free up to ${free.guests}, A$${small.price.standard} up to ${small.guests}, A$${medium.price.standard} up to ${medium.guests} and A$${large.price.standard} up to ${large.guests.toLocaleString("en-AU")}. Guests never pay.`,
          },
        ]),
  ];

  return (
    <ContentPage
      path="/photographers"
      inApp={inApp}
      wideTitle
      eyebrow="For event photographers"
      title={
        <>
          Corporate event photo delivery. Every guest finds their <em className="kb-accent">own photos</em>.
        </>
      }
      lead="Conferences, awards nights, Christmas parties: upload full resolution through your own link, straight into the right album, credited by name. Every guest takes a selfie and finds the photos they're in, so your work gets seen and downloaded instead of sitting in a folder."
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
          title: "What your client's event manager gets",
          body: (
            <p>
              Their logo and colour on every screen, not ours. A guest list import from Eventbrite, Humanitix, Luma or a
              spreadsheet, or an open link. A name check on the guest list. Removal requests that hide a photo at once,
              with the organiser deciding within 7 days. Photos, guest details and faceprints stored in Sydney. Only each
              guest sees their own face search matches. It&apos;s an easy yes for HR and marketing teams who worry about
              staff photos on a public link.
            </p>
          ),
        },
        {
          title: "Christmas party season",
          body: (
            <p>
              November and December are full of work functions. Upload during the event and photos appear in the gallery
              as they land, so guests can have them the same night. The A4 QR poster and announcement email are ready to
              hand to the client. Send them to the page on <Link href="/christmas-parties">work Christmas party photos</Link>.
            </p>
          ),
        },
        {
          title: "Offering it to your corporate clients",
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
      related={cards("/christmas-parties", "/conferences", "/guides/get-event-photos-to-attendees-fast")}
      cta={{
        title: "Deliver your next event this way.",
        lead: "Set the event up for a client, or send this page to the organiser and ask for an upload link.",
        points: ["Full resolution, credited by name", "No account needed to upload", "Guests find their own photos"],
        secondary: { href: "/how-it-works", label: "See how it works" },
      }}
    />
  );
}

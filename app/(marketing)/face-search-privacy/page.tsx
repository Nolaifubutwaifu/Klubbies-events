import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Points } from "@/components/site/ContentPage";
import { cards } from "@/lib/copy/pages";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Face Search Privacy: Facial Recognition Explained",
  description: "How Klubbies Events uses facial recognition to help attendees find their own event photos: consent, faceprints, who can see matches, and when everything is deleted.",
  path: "/face-search-privacy",
});

/*
 * The privacy policy in plain words, for organisers and attendees who search
 * before they say yes (audit F20). Keep it in step with app/(marketing)/privacy
 * and lib/faces/copy.ts: this page explains, the policy is the source.
 */
export default async function FaceSearchPrivacyPage() {
  const inApp = await isNativeAppRequest();

  const faqs = [
    {
      q: "Can an organiser search the photos for a particular person?",
      a: "No. There is no way to search an event's photos for a person. Not for other attendees, and not for the organiser. Each attendee only ever sees their own matches.",
    },
    {
      q: "Is a faceprint made of me if I never sign in?",
      a: "If the event has face search on, yes: faces are found in every photo and a faceprint is made for each, including people who never open the gallery. Nobody is named or matched unless they add their own selfie. The faceprints are deleted with the photo, or all at once if the organiser turns face search off.",
    },
    {
      q: "How do I turn face search off?",
      a: "Open Your photos in the event and choose Turn off face search and delete my face data. Your selfie, your faceprint and every match are deleted within 24 hours.",
    },
    {
      q: "What if it matches the wrong person?",
      a: "Mark the photo Not me. A rejected match is never suggested again. Matches are suggestions, never evidence that someone was somewhere.",
    },
  ];

  return (
    <ContentPage
      path="/face-search-privacy"
      inApp={inApp}
      eyebrow="Face search and privacy"
      title={
        <>
          How face search works, and what it <em className="kb-accent">never</em> does.
        </>
      }
      lead="Face search uses facial recognition so each attendee can find the photos they're in. Here is exactly what happens to faces, who can see what, and when it is deleted."
      facts={[
        { label: "Consent", title: "Opt in, per attendee", body: "Only people who add a selfie are matched." },
        { label: "Matches", title: "Only you see yours", body: "Nobody can search for a person." },
        { label: "Storage", title: "Stays in Sydney", body: "Faceprints are never copied elsewhere." },
        { label: "Deletion", title: "Within 24 hours", body: "When you turn it off." },
      ]}
      sections={[
        {
          title: "What face search is for",
          body: (
            <p>
              A big event can have thousands of photos. Face search lets each attendee take one selfie and see every photo
              they appear in, across every album, instead of scrolling through all of them. It is a convenience for the
              person in the photos, and it is built so it can only ever be used for that.
            </p>
          ),
        },
        {
          title: "What happens to faces in the photos",
          body: (
            <>
              <p>
                When an event has face search on, its photos are sent to Amazon Rekognition, run by Amazon Web Services in
                Sydney. Rekognition finds each face and makes a faceprint: a mathematical description of the face, not a
                photo. This happens for every face in every photo, including people who never open the gallery.
              </p>
              <p>
                A faceprint on its own names nobody. It is only linked to a person when that person adds their own selfie.
                A faceprint is biometric information, which is sensitive information under the Privacy Act 1988, so we
                say this plainly rather than hiding it.
              </p>
            </>
          ),
        },
        {
          title: "Consent, attendee by attendee",
          body: (
            <>
              <p>
                Every attendee sees a notice that faces in the photos are analysed before they see any photos. Being
                findable is a separate choice: only attendees who take a selfie, and give their express consent on the
                selfie screen, are matched.
              </p>
              <Points
                items={[
                  "Attendees who skip the selfie are never matched or named.",
                  "Only the attendee sees their matches. Not other attendees, not the organiser.",
                  "There is no way to search an event's photos for a person.",
                  "The organiser can turn face search off for the whole event.",
                ]}
              />
            </>
          ),
        },
        {
          title: "When it is deleted",
          body: (
            <Points
              items={[
                "Your selfie, its faceprint and your matches: within 24 hours of turning face search off, of your access to the event ending, or of the organiser turning the feature off.",
                "A faceprint made from a photo: when that photo is deleted for good.",
                "Every faceprint for an event: when the organiser turns face search off, and when the gallery closes.",
                "Deleting your account deletes your selfie and faceprints straight away.",
              ]}
            />
          ),
        },
        {
          title: "Where it is stored, and who processes it",
          body: (
            <p>
              Selfies and faceprints are stored in Sydney, Australia, and processed by Amazon Web Services in the Sydney
              region on our behalf. They are never copied anywhere else. We do not sell face data and do not share it with
              anyone else. Photos themselves also live in Sydney, with a backup copy at Cloudflare that may be outside
              Australia.
            </p>
          ),
        },
        {
          title: "Accuracy, and what to do when it's wrong",
          body: (
            <p>
              Face recognition is not reliable. It misses people and sometimes matches the wrong person, especially in dim
              light, in crowds, and in blurred photos. Matches are suggestions, not facts. Any wrong match can be marked
              Not me and is never suggested again. Anyone can ask for a photo of themselves to come down: it hides at once
              while the organiser decides.
            </p>
          ),
        },
        {
          title: "The full policy",
          body: (
            <p>
              This page explains the parts people ask about most. The <Link href="/privacy">privacy policy</Link> is the
              complete version, including your rights under the Australian Privacy Principles and how to contact the OAIC.
            </p>
          ),
        },
      ]}
      faqs={faqs}
      related={cards("/about", "/conferences", "/student-clubs")}
      cta={{
        title: "Private by default.",
        lead: "Only people you let in see the gallery, and face search only ever shows people their own photos.",
        points: ["Opt in for every attendee", "Stored in Sydney", "Off whenever they like"],
        secondary: { href: "/privacy", label: "Read the privacy policy" },
      }}
    />
  );
}

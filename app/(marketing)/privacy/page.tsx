import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

// A draft written to match what the code does, for a lawyer to check. Not
// legal advice. Keep it in step with lib/copy/site.ts and lib/faces/copy.ts.
const SECTIONS: [string, string][] = [
  [
    "Who is responsible",
    "Klubbies Events runs the service. The organiser of each event decides who can get in, which photos are shared and for how long. For your details on an organiser's guest list, the organiser collected them and shared them with us to let you in.",
  ],
  [
    "What we store",
    "Your name and email, either from the organiser's guest list or from what you typed when you joined through the event link. When you sign in we store the name you gave, when you first signed in, and a session so you stay signed in for up to 30 days. Organisers and photographers upload photos and videos, which we keep exactly as uploaded, plus smaller preview copies. Each photo records the name of the photographer who uploaded it.",
  ],
  [
    "Who can see an event's photos",
    "Only people the organiser let in who have confirmed their email with a one-time code: anyone with the event link, or only the guest list, depending on how the organiser set up the event. Nothing is public or indexed by search engines, and every image is served through a link that expires within minutes. Photographers who upload through a link can't see the gallery.",
  ],
  [
    "We log who opens what",
    "Every time an attendee views or downloads a photo or video we record which item, when, a scrambled version of the network address, and the browser. The event's organisers can see this log. We tell you because it is a record of your activity and you should know it exists.",
  ],
  [
    "How organisers found us",
    "If you arrive through one of our tracked links (a flyer's QR code, or the Photos by Klubbies Events line on a gallery), we remember which link in a cookie for 30 days and note it on any event you create, with your answer to \"How did you hear about us?\" if you give one. It is only ever about organisers: guests opening a gallery are not tracked, and the cookie holds nothing but the link's name.",
  ],
  [
    "How long galleries stay open",
    "Attendees can open an event's photos for 12 months after the event, unless the organiser closes the gallery earlier. We email you a week before it closes, unless you turned those reminders off. When a gallery closes, attendees' selfies and all of the event's face search data are deleted within 24 hours.",
  ],
  [
    "When photos and guest lists are deleted",
    "12 months after the event, every photo and video, the guest list, the access log and any face data left are deleted, unless the organiser has paid to keep the event for another year. The organiser is warned 30 and 7 days before. The copy of each photo at Cloudflare is deleted 30 days after the photo. After that nothing can be recovered. We keep the event's name, dates, payment records and usage totals, which hold no photos and no attendee details.",
  ],
  [
    "Removing a photo of you",
    "Open the photo and choose Request removal. It is hidden from attendees straight away while the organiser decides, and if they have not answered within 7 days it is removed. You do not have to give a reason. An organiser can switch this off, in which case contact them directly; organisers can delete any photo.",
  ],
  [
    "Where data lives",
    "Photos, attendee details and faceprints are stored in Sydney, Australia. A second copy of each photo and video, and of event logos, is kept by Cloudflare R2 as a backup, encrypted at rest, and full quality downloads and video are delivered from that copy. Cloudflare may hold it outside Australia. Selfies and faceprints are never copied: they stay in Sydney. When a photo is deleted for good, its copy at Cloudflare is deleted 30 days later. Sign-in emails are delivered by Resend. Payments are processed by Stripe, which never shares card details with us.",
  ],
  // Say the uncomfortable part plainly: we create a faceprint for everyone in
  // a photo, not only for people who opted in.
  [
    "Face search: what we collect",
    "When an event has face search on, we send that event's photos to Amazon Rekognition, operated by Amazon Web Services in Sydney, Australia. Rekognition finds faces and creates a faceprint, a mathematical description of a face, for each one. This happens for every face in the photo, including people who never open the gallery. If you choose to add a selfie, we also create a faceprint from it and store the selfie. A faceprint is biometric information, which is sensitive information under the Privacy Act 1988. We only create one from your selfie with your express consent, given on the selfie screen, and you can withdraw it at any time.",
  ],
  [
    "Face search: what we use it for",
    "To show you the photos you appear in. Nothing else. Only you can see your own matches. There is no feature that searches an event's photos for a particular person, for attendees, for organisers or for our own staff, and we have not built one.",
  ],
  [
    "Face search: accuracy",
    "Face recognition is not reliable. It misses people, and it sometimes matches the wrong person, particularly in dim light, in crowds, and where a photo is blurred or someone is turned away. Matches are suggestions, not statements of fact, and should never be treated as evidence that someone was or was not somewhere. You can reject any wrong match, and a rejected match is never suggested again.",
  ],
  [
    "Face search: how long we keep it",
    "A faceprint made from a photo is deleted when that photo is deleted for good. A photo an organiser deletes waits 30 days in Recently deleted, where only organisers can see it, in case it was deleted by mistake; a photo taken down because someone asked is deleted straight away. Your selfie and the faceprint made from it are deleted when you turn face search off, when your access to the event ends, or when the organiser turns the feature off: within 24 hours in each case. When an organiser turns it off, every faceprint for that event is deleted.",
  ],
  [
    "Face search: who else sees it",
    "Amazon Web Services processes faceprints on our behalf, in the ap-southeast-2 (Sydney) region. We do not sell face data and we do not share it with anyone else.",
  ],
  [
    "The iPhone app",
    "The app shows the same Klubbies Events as the website and stores the same things. It uses the camera only when you take a selfie or scan an event's QR code, and it asks for permission to add to your photo library only when you tap Save to Photos, so it can never read your library. If you turn on notifications, we store a device token from Apple against your account so we can tell your phone about new albums; it is deleted when you delete your account, and when you remove the app we delete it the next time Apple tells us it no longer works. The app has no advertising, no tracking and no analytics tools.",
  ],
  [
    "Deleting your account",
    "Open your profile and choose Delete my account, in the app or on the website. That deletes your sign-in, your profile and photo, your saved photos, your face search selfie and faceprints, and your notification device tokens, straight away. If you joined an event through its link, you also leave that event's attendee list. Photos you uploaded belong to the event and stay; ask the organiser to take any of them down. A guest list the organiser imported keeps your name, and the activity log keeps its entries, because both are the organiser's records.",
  ],
  [
    "Your choices and rights",
    "You can change your name and email preferences on your profile and turn face search off per event. Under the Australian Privacy Principles you can ask for a copy of the personal information we hold about you and ask us to correct it. To do that, to complain, or with any other question, email us at the address on the support page. If you are not happy with our answer you can contact the Office of the Australian Information Commissioner at oaic.gov.au.",
  ],
];

export default function PrivacyPage() {
  const words = SECTIONS.reduce((sum, [title, body]) => sum + `${title} ${body}`.split(/\s+/).length, 0);
  return (
    <LegalPage
      doc="privacy"
      title="Privacy at Klubbies Events"
      updated="27 September 2026"
      minutes={Math.max(1, Math.round(words / 220))}
      sections={SECTIONS.map(([title, body]) => ({ title, body: <p>{body}</p> }))}
    />
  );
}

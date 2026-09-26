import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS: [string, string][] = [
  [
    "What we store",
    "Your club gives us your name and email as part of its member list. When you sign in we store the name you typed, when you first signed in, and a session so you stay signed in for up to 30 days. Clubs upload photos and videos, which we keep exactly as uploaded, plus smaller preview copies.",
  ],
  [
    "Who can see club media",
    "Only people on that club's member list who have confirmed their email with a one time code. Nothing is public, and every image is served through a link that expires within minutes.",
  ],
  [
    "We log who opens what",
    "Every time a member views or downloads a photo or video we record which item, when, a scrambled version of the network address, and the browser. Club admins can see this log. We tell you because it is a record of your activity and you should know it exists.",
  ],
  [
    "When you leave a club",
    "If a club admin takes you off the member list, you keep access to what was shared before that for 30 days, and we email you about it. After that your access to that club ends.",
  ],
  [
    "Where data lives",
    "Club data is stored in Sydney, Australia. Sign in emails are delivered by Resend.",
  ],
  [
    "Removing a photo of you",
    "Open the photo and choose Take it down. It is hidden from everyone straight away while the committee decides, and if they have not answered within 7 days it is removed. You do not have to give a reason. A club can switch this off, in which case ask the committee directly; admins can delete any item.",
  ],
  // The masterfile's rule about the access log applies here too: say the
  // uncomfortable part plainly rather than burying it. The uncomfortable part
  // is that we create a faceprint for everyone in a photo, not only for
  // people who opted in.
  [
    "Face recognition: what we collect",
    "When a club turns on face recognition, we send that club's photos to Amazon Rekognition, operated by Amazon Web Services in Sydney, Australia. Rekognition finds faces and creates a faceprint, a mathematical description of a face, for each one. This happens for every face in the photo, including people who are not Klubbies members. If you choose to enrol, we also create a faceprint from a selfie you give us, and we store that selfie. A faceprint is biometric information, which is sensitive information under the Privacy Act 1988. We only create one from your selfie with your express consent, given on the enrolment screen, and you can withdraw it at any time.",
  ],
  [
    "Face recognition: what we use it for",
    "To show you photos you appear in. Nothing else. Only you can see your own matches. Klubbies has no feature that searches a club's photos for a particular person, for members, for committees or for our own staff, and we have not built one.",
  ],
  [
    "Face recognition: accuracy",
    "Face recognition is not reliable. It misses people, and it sometimes matches the wrong person, particularly in dim light, in crowds, and where a photo is blurred or someone is turned away. Matches are suggestions, not statements of fact, and should never be treated as evidence that someone was or was not somewhere. You can reject any wrong match, and a rejected match is never suggested to you again.",
  ],
  [
    "Face recognition: how long we keep it",
    "A faceprint made from a photo is deleted when that photo is deleted. Your reference faceprint and your selfie are deleted when you withdraw consent, when your membership ends, or when the club turns the feature off: within 24 hours in each case. When a club turns it off, every faceprint for that club is deleted.",
  ],
  [
    "Face recognition: who else sees it",
    "Amazon Web Services processes faceprints on our behalf, in the ap-southeast-2 (Sydney) region. We do not sell face data and we do not share it with anyone else.",
  ],
];

export default function PrivacyPage() {
  const words = SECTIONS.reduce((sum, [title, body]) => sum + `${title} ${body}`.split(/\s+/).length, 0);
  return (
    <LegalPage
      doc="privacy"
      title="Privacy at Klubbies"
      updated="[DATE]"
      minutes={Math.max(1, Math.round(words / 220))}
      sections={SECTIONS.map(([title, body]) => ({ title, body: <p>{body}</p> }))}
    />
  );
}

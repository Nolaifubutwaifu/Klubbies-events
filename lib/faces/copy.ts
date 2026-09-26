// The three pieces of face recognition copy, versioned together with
// CONSENT_VERSION and CLUB_NOTICE_VERSION in constants.ts. If the wording
// shifts materially, bump the version and re-prompt rather than quietly
// treating an old consent as covering new text.
//
// Drafts, written to be checked by someone qualified. Not legal advice.
//
// Three claims were removed in the 2026-09-23 pass because they were not true
// of the code: that nobody at Klubbies could search by face (the service role
// and SearchFacesByImage both exist, there is simply no feature), that the
// member's consent covered only their selfie (a faceprint of them may already
// exist from the club's photos), and that the committee carried the
// responsibility for telling members (Klubbies is the entity holding the
// faceprints; a tickbox does not move that).

export const MEMBER_CONSENT = {
  title: "Find yourself in club photos",
  lead: "Klubbies can look for your face in this club's photos and show you the ones you appear in.",
  what: "To do that we create a mathematical description of your face, called a faceprint, from the selfie you give us, and compare it against faces in photos this club has uploaded. That faceprint is biometric information.",
  points: [
    "Only you see your matches. There is no way to search this club's photos for a person: we have not built one, and the committee cannot either.",
    "It will not always be right. Dim lighting, crowds and motion blur cause both misses and occasional wrong matches. Tap “Not me” on anything wrong.",
    "You can turn it off whenever you like. That deletes your selfie, your faceprint and every match within 24 hours.",
  ],
  tickbox:
    "I consent to Klubbies creating and storing a faceprint from my selfie, so it can be matched against faces in this club's photos.",
} as const;

/**
 * Shown to every member of a club that has this on, enrolled or not, because
 * a faceprint is made of their face either way. It asks them to acknowledge
 * that this is happening — it is not consent, and it is deliberately not
 * worded as consent. Consent is the separate, genuinely optional enrolment
 * step, where the member chooses to be identifiable.
 */
export const MEMBER_NOTICE = {
  title: "This club analyses faces in its photos",
  points: [
    "Every face in this club's photos is turned into a faceprint, a mathematical description of a face, stored with Amazon Web Services in Sydney. That includes your face, whether or not you choose to be findable.",
    "A faceprint is deleted when the photo it came from is deleted, and every faceprint for this club is deleted if the committee turns this off.",
    "Nobody is named unless they enrol with their own selfie, and anyone who enrols sees only their own photos.",
  ],
  tickbox: "I understand that faces in this club's photos are analysed.",
} as const;

export const CLUB_NOTICE = {
  title: (club: string) => `Turning on face recognition for ${club}`,
  lead: "This analyses faces in every photo your club has already uploaded, and every photo uploaded from now on.",
  points: [
    "It applies to everyone in your photos, not only members who opt in. That includes guests, plus-ones and members who never enrol.",
    "A faceprint is created for each face and stored with Amazon Web Services in Sydney until the photo is deleted.",
    "Only members who enrol with their own selfie can be identified, and each of them sees only their own photos. There is no way to search for a member by face: not for you, and not through anything we have built.",
    "Your members should know this is on. We show every member a notice and ask them to acknowledge it, but you know your club and we do not.",
    "Turning it off deletes every faceprint for this club.",
  ],
  tickbox: (club: string) => `I have read this and I have authority to turn it on for ${club}.`,
} as const;

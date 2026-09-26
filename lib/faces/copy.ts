// The three pieces of face recognition copy, versioned together with
// CONSENT_VERSION, EVENT_NOTICE_VERSION and MEMBER_NOTICE_VERSION in
// constants.ts. If the wording shifts materially, bump the version and
// re-prompt rather than quietly treating an old consent as covering new text.
//
// Drafts, written to be checked by someone qualified. Not legal advice.
//
// Carried over from Klubbies, where three claims were removed because they
// were not true of the code: that nobody at Klubbies could search by face (the
// service role and SearchFacesByImage both exist, there is simply no feature),
// that consent covered only the selfie (a faceprint of the person may already
// exist from the event's photos), and that the organiser carried the
// responsibility for telling people (Klubbies Events holds the faceprints).

export const MEMBER_CONSENT = {
  title: "Find the photos you're in",
  lead: "Klubbies Events can look for your face in this event's photos and show you the ones you appear in.",
  what: "To do that we create a mathematical description of your face, called a faceprint, from the selfie you give us, and compare it against faces in the photos taken at this event. That faceprint is biometric information.",
  points: [
    "Only you see your matches. There is no way to search this event's photos for a person: we have not built one, and the organiser cannot either.",
    "It will not always be right. Dim rooms, crowds and motion blur cause both misses and occasional wrong matches. Tap “Not me” on anything wrong.",
    "You can turn it off whenever you like. That deletes your selfie, your faceprint and every match within 24 hours.",
  ],
  tickbox:
    "I consent to Klubbies Events creating and storing a faceprint from my selfie, so it can be matched against faces in this event's photos.",
} as const;

/**
 * Shown to every attendee of an event that has this on, enrolled or not,
 * because a faceprint is made of their face either way. It asks them to
 * acknowledge that this is happening. It is not consent, and it is
 * deliberately not worded as consent: consent is the separate, genuinely
 * optional enrolment step.
 */
export const MEMBER_NOTICE = {
  title: "This event's photos are analysed for faces",
  points: [
    "Every face in this event's photos is turned into a faceprint, a mathematical description of a face, stored with Amazon Web Services in Sydney. That includes your face, whether or not you choose to be findable.",
    "A faceprint is deleted when the photo it came from is deleted, and every faceprint for this event is deleted if the organiser turns this off.",
    "Nobody is named unless they take a selfie themselves, and anyone who does sees only their own photos.",
  ],
  tickbox: "I understand that faces in this event's photos are analysed.",
} as const;

export const EVENT_NOTICE = {
  title: (event: string) => `Face recognition for ${event}`,
  lead: "This analyses faces in every photo already uploaded to the event, and every photo uploaded from now on.",
  points: [
    "It applies to everyone in the photos, not only attendees who opt in. That includes speakers, staff, guests and anyone who never opens the gallery.",
    "A faceprint is created for each face and stored with Amazon Web Services in Sydney until the photo is deleted.",
    "Only attendees who take their own selfie can be identified, and each of them sees only their own photos. There is no way to search for a person by face: not for you, and not through anything we have built.",
    "Tell your attendees this is on, for example in the event invitation or on the photography notice at the venue. We also show every attendee a notice and ask them to acknowledge it.",
    "Turning it off deletes every faceprint for this event.",
  ],
  tickbox: (event: string) => `I have read this and I have authority to turn it on for ${event}.`,
} as const;

// The one list of what Klubbies Events does, for every public page and the
// billing screens. Rule for editing: a line goes in only when the feature is
// live in the app. Checked against the code on 27 Sep 2026:
//
//   - sign-in codes are 8 digits (Supabase mints 8 for this project)
//   - access is "anyone with the link" (default) or "guest list only"
//   - galleries close to attendees on events.access_ends_at, set by default to
//     90 days after the event's last day; organisers keep access
//   - photographer links need no account and credit the photographer by name
//   - removal requests hide the photo at once; the organiser confirms or
//     restores (silence confirms after 7 days)
//   - face recognition is on by default; the organiser can turn it off; each
//     attendee chooses whether to add a selfie
//   - the share kit makes a QR code (PNG and SVG) and a printable A4 poster
//   - guest list import reads CSV, TSV, XLSX and XLS
//
// Not claimed anywhere, because it is not true: live slideshows, public
// sharing links, watermarking, or exact scheduled publishing times (the hourly
// cron makes those approximate).

import { TIERS } from "@/lib/billing/plans";

/**
 * How the tiers are described (docs/handoff-pricing-tiers.md). The numbers
 * come from lib/billing/plans.ts; Stripe charges what the billing page asks.
 * Never shown inside the iPhone app.
 */
export const PRICE = {
  amount: "Free",
  line: `Free for up to ${TIERS.free.guests} guests, paid sizes from A$${TIERS.small.price.standard} per event`,
  unit: "One payment per event",
  trust: ["Free for small events", "One payment per event", "No subscription"],
  note: `Free for up to ${TIERS.free.guests} guests and ${TIERS.free.photos} photos, no card needed. Bigger events pay once, by size.`,
  includes: [
    "Face search so attendees find their own photos",
    "Your logo and colour on every attendee screen",
    "QR code, printable poster and announcement email",
    "Photographer upload links, no account needed",
    "Full quality photos and video, originals kept",
    "Gallery open to guests for 12 months after the event",
  ],
  /** The asterisk under the pricing table. */
  footnote:
    "Up to 10% more guests than the size are included. Past that, guests can keep joining for 2 days, up to 50% over, while you upgrade. Upgrading after the event has run out of room costs the difference plus 25%.",
  clubs: `Student club? Club prices from A$${TIERS.small.price.club} with your campus club code.`,
} as const;

export const FACE = {
  title: "Every attendee finds their own photos",
  lead: "One selfie and Klubbies Events shows each attendee the photos they're in, across every album. Nobody scrolls through 2,000 photos looking for themselves.",
  points: [
    {
      title: "Their choice",
      body: "Every attendee is told it's on, then decides for themselves. Nobody is named unless they add their own selfie.",
    },
    {
      title: "Only they see their matches",
      body: "There is no way to search an event's photos for a person. Not for other attendees, and not for the organiser.",
    },
    {
      title: "Off whenever they like",
      body: "Turning it off deletes their selfie, their faceprint and every match within 24 hours.",
    },
  ],
  caveat: "Matches are suggestions. Dim rooms and motion blur cause misses, and anything wrong can be marked Not me.",
} as const;

export type Step = { title: string; body: string };

export const STEPS: Step[] = [
  {
    title: "Set up in ten minutes",
    body: "Name the event, add your logo and colour, and choose who gets in: anyone with the link, or only your guest list.",
  },
  {
    title: "Photographers upload",
    body: "Each photographer gets their own upload link. No account, no app. Full resolution, straight into the right album, credited by name.",
  },
  {
    title: "Attendees find themselves",
    body: "Put the QR code on a screen or a table card. Attendees confirm their email, take a selfie, and download every photo they're in.",
  },
];

export type Feature = {
  icon: "search" | "face" | "heart" | "download" | "flag" | "bell" | "list" | "upload" | "camera" | "lock" | "qr" | "brand";
  title: string;
  body: string;
};

export const ORGANISER_FEATURES: Feature[] = [
  {
    icon: "brand",
    title: "Your brand, not ours",
    body: "Your logo, your colour and your event name on every attendee screen and email.",
  },
  {
    icon: "lock",
    title: "Private by default",
    body: "Nothing is public. Every view and download is tied to a confirmed email, and the gallery closes on the date you set.",
  },
  {
    icon: "upload",
    title: "Photographer links",
    body: "One link per photographer, per album. Uploads resume after a dropped connection, and you see who sent what.",
  },
  {
    icon: "qr",
    title: "Share kit",
    body: "A QR code, a printable poster and a ready-to-send email, so attendees find the gallery without you chasing them.",
  },
  {
    icon: "list",
    title: "Guest list import",
    body: "Drop in the export from Eventbrite, Humanitix or a spreadsheet. We find the name and email columns.",
  },
  {
    icon: "flag",
    title: "Removal requests",
    body: "An attendee can ask for a photo to come down. It hides at once, and you decide whether it stays gone.",
  },
];

export const ATTENDEE_FEATURES: Feature[] = [
  { icon: "face", title: "Photos of you, found", body: "One selfie, and every photo they're in is in one place." },
  { icon: "download", title: "Full quality downloads", body: "The photographer's original file, one at a time or all at once." },
  { icon: "heart", title: "Saved for later", body: "Save the good ones and come back to them." },
  { icon: "bell", title: "Told when photos land", body: "An email when a new album is published, and a week before the gallery closes." },
];

export const PRIVACY_PROMISES: Step[] = [
  {
    title: "Only people you let in",
    body: "Attendees confirm their email with a code before they see anything. In guest-list mode, only your list gets a code.",
  },
  {
    title: "Stored in Australia",
    body: "Photos, attendee details and faceprints are stored in Sydney. A copy of each photo is kept and delivered by Cloudflare, which may be outside Australia; faceprints never leave Sydney.",
  },
  {
    title: "You can see who opened what",
    body: "Every view and download is logged, and attendees are told that in the privacy policy.",
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Do attendees need to download an app?",
    a: "No. The gallery works in any phone or laptop browser. There is an iPhone app for people who prefer it, and the QR code works either way.",
  },
  {
    q: "Do photographers need an account?",
    a: "No. You create an upload link for each photographer and send it to them. It works in any browser and expires on the date you choose.",
  },
  {
    q: "Who can see the photos?",
    a: "Only people who confirm their email through your event link, or, in guest-list mode, only the addresses on your list. Nothing is ever public or indexed by search engines.",
  },
  {
    q: "How long do attendees have access?",
    a: "12 months after the event, on every size, including Free. You can close the gallery earlier in the event's settings. After 12 months the photos are deleted, unless you keep the event for another year; you're emailed 30 and 7 days before.",
  },
  {
    q: "How does face search handle consent?",
    a: "Every attendee sees a notice that faces are analysed before they see any photos. Being findable is separate and optional: only attendees who add their own selfie are matched, and only they see the results.",
  },
  {
    q: "What does it cost?",
    a: `Free for up to ${TIERS.free.guests} guests and ${TIERS.free.photos} photos. Bigger events pay once, by size: A$${TIERS.small.price.standard} for up to ${TIERS.small.guests} guests, A$${TIERS.medium.price.standard} for up to ${TIERS.medium.guests}, A$${TIERS.large.price.standard} for up to ${TIERS.large.guests.toLocaleString("en-AU")}. Student clubs pay less with their campus club code. No subscription, and no limit on photographers.`,
  },
  {
    q: "What if more guests come than I planned?",
    a: "Up to 10% over is included. Past that, guests can keep joining for 2 days, up to 50% over, while you upgrade for the difference plus 25%. If nobody upgrades, the guests who joined last are paused, not removed, until you make room.",
  },
  {
    q: "How do videos count?",
    a: "Each started minute of video counts as 10 photos toward your event's allowance, so a 2 minute clip counts as 20. Each video can be up to 500 MB.",
  },
];

/** Questions about money, left out of the FAQ inside the iPhone app. */
export const PRICE_QUESTIONS = new Set(["What does it cost?", "What if more guests come than I planned?"]);

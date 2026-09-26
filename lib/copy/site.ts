// The one list of what Klubbies does, for every public page.
//
// Home, How it works and the legal pages all read from here so they promise
// the same thing in the same words (audit finding M6). Rule for editing: a
// line goes in only when the feature is live in the app. Checked against the
// code on 26 Sep 2026:
//
//   - sign-in codes are 8 digits (Supabase mints 8 for this project)
//   - the per-album upload option is labelled "Any member" / "Committee only"
//   - photo removal requests are live and on by default; the photo hides at
//     once and the committee confirms (silence confirms after 7 days)
//   - the new album email is sent when an album is published
//   - "Save to Photos" uses the phone's share sheet; laptops get a zip
//   - roster import reads CSV, TSV, XLSX and XLS
//   - face recognition is on for every club by default (the committee can
//     turn it off); each member still chooses whether to add a selfie
//
// Not claimed anywhere, because it is not true: a free period before the
// first album, double-tap to favourite, or exact scheduled publishing times
// (the hourly cron makes those approximate).

export const PRICE = {
  amount: "A$20",
  line: "A$20 a month per club",
  trust: ["A$20 a month per club", "Unlimited members", "Cancel any time"],
  /** What is and isn't charged, stated the way billing actually works. */
  note: "Setting up is free. You pay when you activate the club to add members and upload.",
  includes: [
    "Unlimited members and albums",
    "Full quality photos and video",
    "Photos of you, with face recognition",
    "Member list import from CSV or Excel, every semester",
    "Cancel any time, keep what's there",
  ],
} as const;

export const FACE = {
  title: "Find every photo of you",
  lead: "Add one selfie and Klubbies finds the photos you're in, across every album your club has shared. Only you see them.",
  points: [
    {
      title: "Your choice",
      body: "Every member is told it's on, then decides for themselves. Nobody is named unless they add their own selfie.",
    },
    {
      title: "Only you see your matches",
      body: "There is no way to search a club's photos for a person. Not for other members, and not for the committee.",
    },
    {
      title: "Off whenever you like",
      body: "Turning it off deletes your selfie, your faceprint and every match within 24 hours.",
    },
  ],
  caveat:
    "Matches are suggestions. Dim rooms and motion blur cause misses, and you can mark anything wrong as Not me.",
} as const;

export type Feature = { icon: "search" | "face" | "heart" | "download" | "flag" | "bell" | "list" | "upload" | "camera"; title: string; body: string };

export const MEMBER_FEATURES: Feature[] = [
  {
    icon: "face",
    title: "Photos of you",
    body: "Add a selfie once and every photo you're in lands on one page, sorted by night.",
  },
  {
    icon: "search",
    title: "Every album you were at",
    body: "Search by event name or scroll back through the year. Last year's ball is two taps away.",
  },
  {
    icon: "download",
    title: "Save at full quality",
    body: "Straight to your Photos app on a phone, one download on a laptop. No 200kb screenshots.",
  },
  {
    icon: "flag",
    title: "Ask for a photo to come down",
    body: "It's hidden the moment you ask, while the committee decides.",
  },
];

export const COMMITTEE_FEATURES: Feature[] = [
  {
    icon: "list",
    title: "Import the member list each semester",
    body: "New members get in. People who dropped off get 30 days to save their photos.",
  },
  {
    icon: "upload",
    title: "Let any member add photos",
    body: "Per album, your call. Leave it on Committee only and only you can add.",
  },
  {
    icon: "camera",
    title: "A link for the photographer",
    body: "Send a hired or guest photographer an upload link. They never see the club.",
  },
];

export const STEPS = [
  {
    title: "Bring your member list",
    short: "Upload the CSV or Excel file your club already keeps. That list is the door.",
    body: "Name the club and you get a fixed web address to share. Drop in the membership CSV or Excel file your club already keeps, or type people in by hand. Klubbies finds the header row, lets you map the name and email columns, and shows exactly who will be added before anything happens.",
  },
  {
    title: "Drop the whole night in",
    short: "Phone photos and video, full quality, one album. Close the tab and it picks up where it stopped.",
    body: "Drag in hundreds of phone photos, the drone clip and the committee headshots. Originals are kept at full quality and smaller copies are made for fast browsing. Uploads keep going while you use the rest of the app, and pick up again if your connection drops.",
  },
  {
    title: "Members sign in, nobody else",
    short: "Members use the email the club already has. Nobody else gets past the door.",
    body: "A member types their name and email. If the email is on the list, we send a code to that address. No password to forget, and no link that works for whoever it gets forwarded to. Members can set a password later if they sign in often.",
  },
] as const;

export const FAQS = [
  {
    q: "Who can see our photos?",
    a: "Only people on your member list, signed in with their own email. Albums aren't public, aren't indexed by search engines, and there's no link you can forward to someone outside the club.",
  },
  {
    q: "How does Photos of you work?",
    a: "Face recognition is on for every club unless the committee switches it off, and every member is told. Then each member decides: add a selfie and we show you the photos you appear in. Only you see your matches, and you can turn it off whenever you like.",
  },
  {
    q: "What happens when someone leaves the club?",
    a: "Take them off the list and their access winds down over 30 days, with reminders so they can save what they want to keep.",
  },
  {
    q: "Do we have to retype our member list?",
    a: "No. Upload the CSV or Excel file your club already keeps and map the columns once.",
  },
  {
    q: "Can members add their own photos?",
    a: "Per album, yes. Set who can add photos to Any member, or leave it on Committee only.",
  },
  {
    q: "What happens if we cancel?",
    a: "You keep access until the end of the month you paid for. Members can still open existing albums, and we give at least 30 days' notice before deleting anything.",
  },
] as const;

export const PRIVACY_PROMISES = [
  { title: "Checked every time", body: "Your member list is the access list. No shareable link works without it." },
  { title: "Not indexed, not public", body: "Searching a member's name will never surface your photos." },
  { title: "A 30 day window to leave", body: "Off the list? A month of reminders to save what you want." },
  { title: "Stored in Sydney", body: "Photos, member lists and faceprints are kept in Australia." },
] as const;

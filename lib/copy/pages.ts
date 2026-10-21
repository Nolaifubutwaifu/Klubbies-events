import type { RelatedLink } from "@/components/site/ContentPage";

// The pages written to be found in search (SEO audit, 20 Oct 2026), as cards
// for each other's "Read next" rows, the footer and /guides. Same rule as
// lib/copy/site.ts: only claim what is live.

export const PAGE_CARDS = {
  "/christmas-parties": {
    title: "For Christmas parties",
    body: "Private work party photos under your brand. Each guest finds theirs with a selfie.",
  },
  "/conferences": {
    title: "For conferences and work events",
    body: "Get photos to every guest before the follow-up email, under your brand.",
  },
  "/student-clubs": {
    title: "For student clubs",
    body: "Balls, formals and club nights, without the 2,000-photo Drive folder.",
  },
  "/photographers": {
    title: "For photographers",
    body: "Deliver event photos to every attendee, credited by name, with no shared drive.",
  },
  "/brisbane": {
    title: "Brisbane events",
    body: "Run from Brisbane, with photos and faceprints stored in Sydney.",
  },
  "/face-search-privacy": {
    title: "Face search and privacy",
    body: "How consent, faceprints and deletion work, in plain words.",
  },
  "/about": {
    title: "About Klubbies Events",
    body: "Who runs it, why it exists, and how attendee photos are protected.",
  },
  "/guides/share-photos-after-a-conference": {
    title: "How to share photos after a conference",
    body: "A step by step plan, from the run sheet to the follow-up email.",
  },
  "/guides/google-drive-vs-private-event-gallery": {
    title: "Google Drive vs a private event gallery",
    body: "What a shared folder does well, where it falls short, and when to switch.",
  },
  "/guides/get-event-photos-to-attendees-fast": {
    title: "How to get event photos to attendees the same night",
    body: "Upload during the event and publish album by album.",
  },
} satisfies Record<string, Omit<RelatedLink, "href">>;

export type CardPath = keyof typeof PAGE_CARDS;

export function cards(...paths: CardPath[]): RelatedLink[] {
  return paths.map((href) => ({ href, ...PAGE_CARDS[href] }));
}

export const GUIDES: CardPath[] = [
  "/guides/share-photos-after-a-conference",
  "/guides/google-drive-vs-private-event-gallery",
  "/guides/get-event-photos-to-attendees-fast",
];

/** Date the guides were written, for their Article markup. */
export const GUIDES_PUBLISHED = "2026-10-21";

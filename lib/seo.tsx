import type { Metadata } from "next";

// What search engines and link previews see (SEO audit, 20 Oct 2026). Fixed to
// the production host so canonicals and the sitemap never point at a preview.
export const SITE_URL = "https://events.klubbies.app";
export const SITE_NAME = "Klubbies Events";
export const INSTAGRAM_URL = "https://www.instagram.com/klubbies.events/";

/** Every page that should be in Google, for app/sitemap.ts. */
export const PUBLIC_PATHS = [
  "/",
  "/how-it-works",
  "/features",
  "/pricing",
  "/faq",
  "/support",
  "/privacy",
  "/terms",
  "/refunds",
  // Written to be found (audit F18 to F20); each also has a card in lib/copy/pages.ts.
  "/about",
  "/brisbane",
  "/conferences",
  "/student-clubs",
  "/photographers",
  "/face-search-privacy",
  "/guides",
  "/guides/share-photos-after-a-conference",
  "/guides/google-drive-vs-private-event-gallery",
  "/guides/get-event-photos-to-attendees-fast",
];

/** Signed-in, private and one-off pages: kept out of search results. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

/** The share image drawn by app/opengraph-image.tsx. */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Klubbies Events: private event photo galleries with face search",
};

/**
 * Title, description, canonical and link preview for one public page. Metadata
 * merges shallowly, so a page's openGraph and twitter replace the root ones
 * whole, file-based image included: this repeats the shared fields.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title: path === "/" ? { absolute: `${title} · ${SITE_NAME}` } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_AU", url: path, title, description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  };
}

/** A schema.org block for the page body. "<" is escaped so copy can't close the tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

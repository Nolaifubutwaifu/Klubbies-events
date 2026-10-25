import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Home } from "@/components/site/Home";
import { getSessionUser } from "@/lib/auth/session";
import { TIER_ORDER, TIERS } from "@/lib/billing/plans";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { INSTAGRAM_URL, JsonLd, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Event Photo Sharing with Face Search",
  description: `Private photo galleries for Australian events. Attendees scan a QR code, take a selfie and get every photo they're in. Free for up to ${TIERS.free.guests} guests.`,
  path: "/",
});

// Who runs the site and what it sells, for search engines. "Klubbies" alone is
// another company's name, so this ties ours to this site. Prices from TIERS.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: "https://events.klubbies.app/icon-512.png", width: 512, height: 512 },
      description: "Private photo galleries for events. Attendees take a selfie and find the photos they're in.",
      address: { "@type": "PostalAddress", addressLocality: "Brisbane", addressRegion: "QLD", addressCountry: "AU" },
      areaServed: { "@type": "Country", name: "Australia" },
      sameAs: [INSTAGRAM_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: ["Klubbies"],
      inLanguage: "en-AU",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      applicationCategory: "PhotographyApplication",
      operatingSystem: "Web, iOS",
      description:
        "Private event photo galleries with face search. Photographers upload through their own links; attendees scan a QR code, take a selfie and download the photos they're in.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: TIER_ORDER.map((tier) => ({
        "@type": "Offer",
        name: TIERS[tier].name,
        price: String(TIERS[tier].price.standard),
        priceCurrency: "AUD",
        description: `Up to ${TIERS[tier].guests.toLocaleString("en-AU")} guests and ${TIERS[tier].photos.toLocaleString("en-AU")} photos${tier === "free" ? "" : ", one payment per event"}`,
      })),
    },
  ],
};

export default async function LandingPage() {
  if (await getSessionUser()) redirect("/events");
  const inApp = await isNativeAppRequest();
  return (
    <>
      {/* No prices inside the iPhone app. */}
      {inApp ? null : <JsonLd data={STRUCTURED_DATA} />}
      <Home inApp={inApp} />
    </>
  );
}

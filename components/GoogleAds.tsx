import Script from "next/script";
import { headers } from "next/headers";
import {
  ADS_HEADER,
  decodeAttribution,
  googleAdsBootstrap,
  googleAdsEventLabel,
  googleAdsId,
  googleAdsScriptSrc,
  googleAdsSignupLabel,
} from "@/lib/ads";

/**
 * Google tag for one subtree: marketing, /start, or /admin.
 * Renders nothing when NEXT_PUBLIC_GOOGLE_ADS_ID is missing or invalid, so
 * those pages make no request and set no cookie of their own.
 */
export async function GoogleAds() {
  const id = googleAdsId();
  if (!id) return null;
  const src = googleAdsScriptSrc(id);
  if (!src) return null;

  const headerStore = await headers();
  const code = googleAdsBootstrap({
    id,
    attribution: decodeAttribution(headerStore.get(ADS_HEADER)),
    eventLabel: googleAdsEventLabel(),
    signupLabel: googleAdsSignupLabel(),
  });
  if (!code) return null;

  const nonce = headerStore.get("x-nonce") ?? undefined;
  return (
    <>
      <Script id="google-ads-gtag" src={src} strategy="afterInteractive" nonce={nonce} />
      <Script id="google-ads-config" strategy="afterInteractive" nonce={nonce}>
        {code}
      </Script>
    </>
  );
}

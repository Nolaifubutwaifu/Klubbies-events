import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { TIERS } from "@/lib/billing/plans";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

/* Geist carries everything functional; Instrument Serif is the display voice
   for event names and attendee page titles, and ships one weight (400).
   `subsets` only picks what is preloaded: latin-ext files are still served,
   on demand, for names that need them. Mono is never above the fold, so it
   isn't preloaded at all (audit F22: seven preloads became three). */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const DESCRIPTION = `Private photo galleries for Australian events. Attendees scan a QR code, take a selfie and get every photo they're in. Free for up to ${TIERS.free.guests} guests.`;

// Public by default so the marketing pages can rank. Private routes opt out
// with NO_INDEX from lib/seo: (app), (auth), /g and the print pages.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_AU", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The iPhone app adds "kb-splash" here before React loads, while its
    // loading screen is up (ios/KlubbiesEvents/WebViewController.swift).
    <html lang="en-AU" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}

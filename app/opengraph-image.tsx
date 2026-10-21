import { ImageResponse } from "next/og";
import { SHARE_IMAGE } from "@/lib/seo";

// The link preview for every public page (Instagram DMs, iMessage, Slack,
// LinkedIn). Drawn in code so there's no image file to keep in step.
export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#0e1424", color: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#ffffff" />
            <path d="M19 15h8v15l11.5-15h9.5L35 30.5 48.5 49H39l-12-16.5V49h-8z" fill="#0e1424" />
            <circle cx="48" cy="16" r="5" fill="#2b4acb" />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Klubbies<span style={{ marginLeft: 12, color: "#c9cdda", fontWeight: 400 }}>Events</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 980 }}>
            Every photo from your event, in every attendee&apos;s hands.
          </div>
          <div style={{ fontSize: 34, color: "#c9cdda" }}>Scan a QR code, take a selfie, get the photos you&apos;re in.</div>
        </div>
      </div>
    ),
    size,
  );
}

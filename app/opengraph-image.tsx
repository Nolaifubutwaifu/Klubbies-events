import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SHARE_IMAGE } from "@/lib/seo";

// The link preview for every public page (Instagram DMs, iMessage, Slack,
// LinkedIn), and the image Twitter cards point at (lib/seo.ts). The mark is
// public/icon-512.png, the same file as the Organization logo, so the share
// image can't drift from the icon. Satori does not rotate SVG reliably.
export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/icon-512.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#0e1424", color: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={src} width={80} height={80} alt="" />
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

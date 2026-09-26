import "server-only";
import QRCode from "qrcode";
import { appUrl } from "@/lib/env";

/** The link attendees open. The QR code, poster and email all point here. */
export function eventLink(handle: string): string {
  return `${appUrl()}/e/${handle}`;
}

/**
 * The event link as an SVG QR code. Error correction M survives a scuffed
 * table card; the quiet zone is kept because phones need it to find the code.
 */
export async function eventQrSvg(handle: string, colour = "#16181d"): Promise<string> {
  return QRCode.toString(eventLink(handle), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: colour, light: "#ffffff" },
  });
}

/** A large PNG for slides and print shops. */
export async function eventQrPng(handle: string, size = 1600): Promise<Buffer> {
  return QRCode.toBuffer(eventLink(handle), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#16181d", light: "#ffffff" },
  });
}

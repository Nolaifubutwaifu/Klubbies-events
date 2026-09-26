import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventContextById } from "@/lib/auth/session";
import { safeFilename } from "@/lib/media/zip";
import { eventQrPng, eventQrSvg } from "@/lib/share";

/** The event's QR code as a download, PNG by default or ?format=svg. */
export async function GET(request: Request, ctx: RouteContext<"/api/events/[id]/qr">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const event = await getEventContextById(id);
  if (!event?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const name = `${safeFilename(event.event.name, "event")} QR.${format}`;
  const headers = { "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" };

  if (format === "svg") {
    return new NextResponse(await eventQrSvg(event.event.handle), { headers: { ...headers, "content-type": "image/svg+xml" } });
  }
  const png = await eventQrPng(event.event.handle);
  return new NextResponse(new Uint8Array(png), { headers: { ...headers, "content-type": "image/png" } });
}

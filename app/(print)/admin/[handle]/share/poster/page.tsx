/* eslint-disable @next/next/no-img-element -- short-lived signed URL */
import type { Metadata } from "next";
import { PrintButton } from "@/components/PrintButton";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { formatEventDates } from "@/lib/format";
import { eventLink, eventQrSvg } from "@/lib/share";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { readableAccent } from "@/lib/theme";

export const metadata: Metadata = { title: "Poster" };

/**
 * An A4 poster for the venue: the event, a big QR code, and three steps. Sits
 * outside the organiser layout so it prints with nothing around it.
 */
export default async function PosterPage(props: PageProps<"/admin/[handle]/share/poster">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const { event } = ctx;
  const accent = readableAccent(event.accent_colour);
  const [qr, logos] = await Promise.all([
    eventQrSvg(handle),
    // The full logo, not the 96px badge: it prints about 190px tall at 300dpi.
    event.logo_path ? signPaths(await createClient(), [event.logo_path], SIGNED_URL_TTL.display) : Promise.resolve(new Map<string, string>()),
  ]);
  const logoUrl = event.logo_path ? (logos.get(event.logo_path) ?? null) : null;
  const meta = [formatEventDates(event.starts_on, event.ends_on), event.venue].filter(Boolean).join(" · ");
  const link = eventLink(handle).replace(/^https?:\/\//, "");

  const steps = [
    ["Scan", "Point your phone camera at the code."],
    ["Confirm", "Enter your email and the code we send you."],
    ["Find yours", "Take a selfie to see every photo you're in."],
  ];

  return (
    <div className="poster-screen flex min-h-dvh flex-col items-center gap-6 bg-[#e9e9e5] py-8 print:block print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { .no-print { display: none !important; } .poster-sheet { box-shadow: none !important; } }
      `}</style>
      <div className="no-print flex items-center gap-3">
        <PrintButton />
        <span className="text-[14px] text-[color:var(--kb-ink-2)]">A4, no margins. Turn off headers and footers in the print dialog.</span>
      </div>

      <article
        className="poster-sheet flex flex-col bg-white text-[#16181d] shadow-[0_20px_60px_-20px_rgb(0_0_0/0.35)]"
        style={{ width: "210mm", height: "297mm", padding: "18mm 18mm 14mm" }}
      >
        <div className="flex items-center justify-between">
          {logoUrl ? <img src={logoUrl} alt="" style={{ height: "16mm", width: "auto", objectFit: "contain" }} /> : <span />}
          {event.organisation ? <span className="text-[14px] text-[#4a4d55]">{event.organisation}</span> : null}
        </div>

        <div className="mt-[14mm]">
          <p className="m-0 text-[15px] font-medium uppercase tracking-[0.12em]" style={{ color: accent }}>
            Your photos from
          </p>
          <h1 className="serif mt-[3mm] text-[64px] leading-[1.02]">{event.name}</h1>
          {meta ? <p className="m-0 mt-[4mm] text-[18px] text-[#4a4d55]">{meta}</p> : null}
        </div>

        <div className="mt-auto flex items-end gap-[12mm]">
          <span
            className="block flex-none [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            style={{ width: "82mm", height: "82mm" }}
            // Generated server-side from the event link by the qrcode package.
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <ol className="m-0 flex list-none flex-col gap-[6mm] p-0 pb-[3mm]">
            {steps.map(([title, body], index) => (
              <li key={title} className="flex gap-[4mm]">
                <span
                  className="flex h-[9mm] w-[9mm] flex-none items-center justify-center rounded-full text-[15px] font-semibold text-white"
                  style={{ background: accent }}
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[18px] font-semibold">{title}</span>
                  <span className="block text-[15px] leading-snug text-[#4a4d55]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-[10mm] flex items-center justify-between border-t border-[#e4e4df] pt-[4mm] text-[14px] text-[#6b6e76]">
          <span>{link}</span>
          {/* The credit line, printed only (pricing handoff §5.7): a second QR
              code would confuse people scanning for the event. */}
          <span>Private to attendees · Gallery by Klubbies Events</span>
        </div>
      </article>
    </div>
  );
}

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
    ["Scan the code", "With your phone camera. No app needed."],
    ["Confirm your email", "Type the code we send you."],
    ["Take a selfie", "See every photo you're in. Optional, and only you see them."],
  ];
  const initials = event.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

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
        className="poster-sheet flex flex-col overflow-hidden bg-white text-[#16181d] shadow-[0_20px_60px_-20px_rgb(0_0_0/0.35)]"
        style={{ width: "210mm", height: "297mm", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <div className="flex flex-col text-white" style={{ background: accent, padding: "15mm 17mm 13mm", gap: "5mm" }}>
          <span
            className="flex items-center justify-center overflow-hidden bg-white font-bold"
            style={{ width: "22mm", height: "22mm", borderRadius: "5mm", color: accent, fontSize: "24px" }}
          >
            {logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "2.5mm" }} /> : initials}
          </span>
          <span className="text-[18px] font-semibold uppercase tracking-[0.1em] text-white/85">Your photos from</span>
          <h1 className="serif m-0 text-[72px] leading-[0.98] !text-white">{event.name}</h1>
        </div>

        <div className="flex flex-1 items-center" style={{ padding: "13mm 17mm", gap: "13mm" }}>
          <div className="flex flex-none flex-col items-center" style={{ gap: "4mm" }}>
            <span
              className="block [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              style={{ width: "78mm", height: "78mm" }}
              // Generated server-side from the event link by the qrcode package.
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <span className="mono text-[16px] text-[#33363d]">{link}</span>
          </div>
          <ol className="m-0 flex list-none flex-col p-0" style={{ gap: "7mm" }}>
            {steps.map(([title, body], index) => (
              <li key={title} className="flex items-start gap-4">
                <span
                  className="flex flex-none items-center justify-center rounded-full text-[18px] font-semibold text-white"
                  style={{ background: accent, width: "11mm", height: "11mm" }}
                >
                  {index + 1}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[22px] font-semibold">{title}</span>
                  <span className="text-[17px] leading-[1.45] text-[#4a4d55]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-between border-t border-[#e4e4df] text-[15px] text-[#4a4d55]" style={{ padding: "6mm 17mm" }}>
          <span>{[event.organisation ? `Hosted by ${event.organisation}` : null, meta].filter(Boolean).join(" · ")}</span>
          {/* The credit line, printed only (pricing handoff §5.7): a second QR
              code would confuse people scanning for the event. */}
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Klubbies Events
          </span>
        </div>
      </article>
    </div>
  );
}

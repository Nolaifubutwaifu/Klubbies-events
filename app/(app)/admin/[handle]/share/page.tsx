import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { isTier, planName } from "@/lib/billing/plans";
import { ANNOUNCEMENT_LIMIT, announcementStatus, canSendAnnouncements } from "@/lib/events/announcements";
import { formatDateTime, formatEventDates, formatLongDate } from "@/lib/format";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { AnnouncementComposer } from "./AnnouncementComposer";
import { eventLink, eventQrSvg } from "@/lib/share";

export const metadata: Metadata = { title: "Share" };

export default async function SharePage(props: PageProps<"/admin/[handle]/share">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const { event } = ctx;
  const link = eventLink(handle);
  const qr = await eventQrSvg(handle);
  const dates = formatEventDates(event.starts_on, event.ends_on);
  const [announce, inApp] = await Promise.all([announcementStatus(event.id), isNativeAppRequest()]);

  const subject = `Your photos from ${event.name}`;
  const email = [
    `Hi there,`,
    ``,
    `Thanks for coming to ${event.name}${dates ? ` on ${dates}` : ""}. The photos are ready.`,
    ``,
    `Open the gallery here: ${link}`,
    ``,
    `Confirm your email with the code we send, then take a quick selfie to see every photo you're in. You can download them at full quality.`,
    event.access_ends_at ? `The gallery is open until ${formatLongDate(event.access_ends_at)}.` : null,
    ``,
    // Hosts are often a person ("Max"), so the sign-off is the name as typed,
    // not "The Max team".
    event.organisation ? event.organisation : `The organisers`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return (
    <main className="flex flex-col gap-6">
      <PageTitle kicker={event.name} title="Share with attendees">
        {event.access_mode === "link"
          ? "Anyone who opens it and confirms their email joins the event."
          : "Only people on your guest list can get in, even with the link."}{" "}
        <Link href={`/admin/${handle}/attendees`}>Change who can get in</Link>
      </PageTitle>

      <section aria-labelledby="link-title" className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[color:var(--kb-line)] bg-white px-5 py-4">
        <h2 id="link-title" className="text-[17px] font-semibold">
          Event link
        </h2>
        <span className="mono min-w-0 flex-1 break-all text-[15px]">{link.replace(/^https?:\/\//, "")}</span>
        <CopyButton value={link} label="Copy link" className="btn btn-secondary" />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="qr-title" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 lg:max-w-[380px]">
          <h2 id="qr-title" className="text-[17px] font-semibold">
            QR code and poster
          </h2>
          <div className="flex items-start gap-4">
            <span
              className="block w-[132px] flex-none overflow-hidden rounded-[8px] border border-[color:var(--kb-line)] bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              // Generated server-side from the event link by the qrcode package.
              dangerouslySetInnerHTML={{ __html: qr }}
              role="img"
              aria-label="QR code for the event link"
            />
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">Put it on the closing slide, the registration desk or table cards.</p>
              <span className="flex flex-wrap gap-2">
                <a href={`/api/events/${event.id}/qr`} className="btn btn-secondary btn-sm no-underline" download>
                  PNG
                </a>
                <a href={`/api/events/${event.id}/qr?format=svg`} className="btn btn-secondary btn-sm no-underline" download>
                  SVG
                </a>
              </span>
            </div>
          </div>
          <Link href={`/admin/${handle}/share/poster`} className="btn btn-primary no-underline" target="_blank">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />
            </svg>
            Print A4 poster
          </Link>
        </section>

        <AnnouncementComposer
          eventId={event.id}
          handle={handle}
          initialSubject={subject}
          initialBody={email}
          canSend={canSendAnnouncements(event)}
          inApp={inApp}
          recipientCount={announce.recipientCount}
          sendsLeft={Math.max(0, ANNOUNCEMENT_LIMIT - announce.sent.length)}
          sent={announce.sent.map((item) => ({ ...item, when: formatDateTime(item.sent_at) }))}
          planName={isTier(event.plan) ? planName(event.plan) : null}
          free={event.plan === "free"}
        />
      </div>
    </main>
  );
}

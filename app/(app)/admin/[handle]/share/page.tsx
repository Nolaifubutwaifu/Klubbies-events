import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
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
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={event.name} title="Share with attendees">
        One link does everything. {event.access_mode === "link"
          ? "Anyone who opens it and confirms their email joins the event."
          : "Only people on your guest list can get in, even with the link."}{" "}
        <Link href={`/admin/${handle}/settings#access`}>Change who can get in</Link>
      </PageTitle>

      <section className="soft-card flex flex-col gap-3 p-5">
        <h2 className="text-[16px] font-semibold">Event link</h2>
        <div className="flex flex-wrap items-center gap-2">
          <code className="mono min-w-0 flex-1 break-all rounded-[8px] border border-[color:var(--kb-line)] bg-[color:var(--kb-cream)] px-3 py-2.5 text-[14px]">
            {link}
          </code>
          <CopyButton value={link} label="Copy link" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <section className="soft-card flex flex-col gap-4 p-5">
          <h2 className="text-[16px] font-semibold">QR code</h2>
          <span
            className="block w-full max-w-[280px] self-center overflow-hidden rounded-[8px] border border-[color:var(--kb-line)] bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            // Generated server-side from the event link by the qrcode package.
            dangerouslySetInnerHTML={{ __html: qr }}
            role="img"
            aria-label="QR code for the event link"
          />
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
            Put it on the closing slide, table cards or the photo booth. Phones open it with the camera app.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/events/${event.id}/qr`} className="btn btn-sm btn-secondary no-underline" download>
              Download PNG
            </a>
            <a href={`/api/events/${event.id}/qr?format=svg`} className="btn btn-sm btn-secondary no-underline" download>
              Download SVG
            </a>
            <Link href={`/admin/${handle}/share/poster`} className="btn btn-sm btn-primary no-underline" target="_blank">
              Print A4 poster
            </Link>
          </div>
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
        />
      </div>
    </main>
  );
}

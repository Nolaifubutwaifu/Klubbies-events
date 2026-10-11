import type { Metadata } from "next";
import Link from "next/link";
import { Disclosure } from "@/components/Disclosure";
import { OpenFromHash } from "@/components/OpenFromHash";
import { CopyButton } from "@/components/CopyButton";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { backfillProgress } from "@/lib/faces/backfill";
import { facesConfigured } from "@/lib/faces/client";
import { eventFaceState } from "@/lib/faces/collections";
import { formatDate } from "@/lib/format";
import { eventLink } from "@/lib/share";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AccessForm } from "./AccessForm";
import { DeleteEvent } from "./DeleteEvent";
import { FaceRecognition } from "./FaceRecognition";
import { LogoUploader } from "./LogoUploader";
import { PrivacySwitches } from "./PrivacySwitches";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/admin/[handle]/settings">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const { event } = ctx;
  const supabase = await createClient();
  const logoUrl = event.logo_path
    ? ((await signPaths(supabase, [event.logo_path], SIGNED_URL_TTL.display)).get(event.logo_path) ?? null)
    : null;

  // Binned rows are hidden from every user client, so the bin's size is read
  // with the service role; requireAdminContext above is the check.
  const admin = createAdminClient();
  const [faceState, faceBackfill, { count: enrolledCount }, { count: binnedAlbums }, { count: binnedItems }] = await Promise.all([
    eventFaceState(event.id),
    backfillProgress(event.id),
    supabase.from("member_face_profiles").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    admin.from("albums").select("id", { count: "exact", head: true }).eq("event_id", event.id).not("deleted_at", "is", null),
    admin
      .from("media")
      .select("id, albums!media_album_id_fkey!inner(deleted_at)", { count: "exact", head: true })
      .eq("event_id", event.id)
      .not("deleted_at", "is", null)
      .is("albums.deleted_at", null),
  ]);
  const binSummary = [
    binnedAlbums ? (binnedAlbums === 1 ? "1 album" : `${binnedAlbums} albums`) : null,
    binnedItems ? (binnedItems === 1 ? "1 photo or video" : `${binnedItems} photos and videos`) : null,
  ].filter(Boolean);
  const link = eventLink(handle);

  const accessLine = [
    event.access_mode === "guest_list" ? "Guest list only" : "Anyone with the link",
    event.access_ends_at ? `open until ${formatDate(event.access_ends_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const binCount = (binnedAlbums ?? 0) + (binnedItems ?? 0);

  const jumps: [string, string][] = [
    ["details", "Details and colour"],
    ["brand", "Logo"],
    ["access", "Access"],
    ["privacy", "Privacy"],
    ["faces", "Face search"],
    ["link", "Event link"],
    ["deleted", "Recently deleted"],
    ["danger", "Delete this event"],
  ];

  return (
    <main className="flex max-w-[960px] flex-col gap-5">
      <PageTitle kicker={event.name} title="Settings">
        Changes save when you press Save in each section.
      </PageTitle>

      <nav aria-label="Jump to" className="flex flex-wrap gap-2">
        {jumps.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-[36px] items-center rounded-full border border-[color:var(--kb-line)] bg-white px-3 text-[14px] font-medium text-[#33363d] no-underline hover:border-[color:var(--kb-ink)] hover:text-[color:var(--kb-ink)] [@media(pointer:coarse)]:min-h-[44px]"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Each group folds away, so the page is a short list to pick from.
          A link to #access (from Attendees, say) opens that group. */}
      <OpenFromHash />
      <div className="flex flex-col gap-3">
        <Disclosure card id="details" title="Details and colour" hint="Name, dates, venue and brand colour" aside={event.name} className="scroll-mt-24">
          <SettingsForm
            eventId={event.id}
            name={event.name}
            organisation={event.organisation}
            description={event.description}
            startsOn={event.starts_on}
            endsOn={event.ends_on}
            venue={event.venue}
            accentColour={event.accent_colour}
          />
        </Disclosure>

        <Disclosure card id="brand" title="Logo" hint="Shown on every attendee screen and the poster" aside={event.logo_path ? "Logo added" : "No logo yet"} className="scroll-mt-24">
          <LogoUploader eventId={event.id} logoUrl={logoUrl} />
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
            Shown on the join page, the gallery, emails and the poster. A square PNG or SVG at least 512 pixels wide, with a
            transparent background, works best.
          </p>
        </Disclosure>

        <Disclosure card id="access" title="Access" hint="Who can get in, and until when" aside={accessLine} className="scroll-mt-24">
          <AccessForm
            eventId={event.id}
            accessMode={event.access_mode === "guest_list" ? "guest_list" : "link"}
            accessEndsAt={event.access_ends_at}
            photosDeleteAt={event.photos_delete_at}
          />
        </Disclosure>

        <Disclosure
          card
          id="privacy"
          title="Privacy"
          hint="Removal requests"
          aside={event.allow_removal_requests ? "Removal requests on" : "Removal requests off"}
          className="scroll-mt-24"
        >
          <PrivacySwitches eventId={event.id} initial={{ allow_removal_requests: event.allow_removal_requests }} />
          <p className="m-0 max-w-[62ch] text-[14px] text-[color:var(--kb-ink-2)]">
            Whether attendees can add photos and download originals is set per album. Nothing is ever public: every photo
            needs a signed-in attendee.
          </p>
        </Disclosure>

        <Disclosure
          card
          id="faces"
          title="Face search"
          hint="Let attendees find the photos they're in"
          aside={faceState?.enabled ? `On · ${(enrolledCount ?? 0).toLocaleString("en-AU")} added a selfie` : "Off"}
          className="scroll-mt-24"
        >
          <FaceRecognition
            eventId={event.id}
            eventName={event.name}
            configured={facesConfigured()}
            enabled={Boolean(faceState?.enabled)}
            enrolledCount={enrolledCount ?? 0}
            backfill={faceBackfill}
          />
        </Disclosure>

        <Disclosure
          card
          id="link"
          title="Event link"
          hint="The link and QR code never change"
          aside={<span className="mono">{link.replace(/^https?:\/\//, "")}</span>}
          className="scroll-mt-24"
        >
          <code className="mono break-all text-[15px]">{link}</code>
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">It never changes, even if you rename the event, so printed QR codes keep working.</p>
          <CopyButton value={link} label="Copy link" className="btn btn-secondary self-start" />
        </Disclosure>

        <Disclosure
          card
          id="deleted"
          title="Recently deleted"
          hint="Restore anything from the last 30 days"
          aside={binCount ? `${binSummary.join(" and ")} · kept 30 days` : "Nothing deleted"}
          className="scroll-mt-24"
        >
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-2)]">
            {binSummary.length
              ? `${binSummary.join(" and ")}. Restore anything deleted in the last 30 days.`
              : "Nothing deleted in the last 30 days. Deleted albums, photos and videos wait here for 30 days."}
          </p>
          <Link href={`/admin/${handle}/settings/deleted`} className="btn btn-secondary self-start no-underline">
            Open Recently deleted
          </Link>
        </Disclosure>

        <Disclosure card id="danger" title="Delete this event" aside="Removes every photo, album and guest" className="scroll-mt-24">
          <DeleteEvent eventId={event.id} eventName={event.name} />
        </Disclosure>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { backfillProgress } from "@/lib/faces/backfill";
import { facesConfigured } from "@/lib/faces/client";
import { eventFaceState } from "@/lib/faces/collections";
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

  return (
    <main className="flex flex-col gap-8 pb-12 pt-2">
      <PageTitle kicker={event.name} title="Settings">
        Event details, branding, who can get in and for how long.
      </PageTitle>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section id="brand" className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="text-[16px] font-semibold">Event details and brand</h2>
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
          </section>

          <section id="access" className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="text-[16px] font-semibold">Access</h2>
            <AccessForm
              eventId={event.id}
              accessMode={event.access_mode === "guest_list" ? "guest_list" : "link"}
              accessEndsAt={event.access_ends_at}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold">Privacy</h2>
            <PrivacySwitches eventId={event.id} initial={{ allow_removal_requests: event.allow_removal_requests }} />
            <p className="m-0 max-w-[62ch] text-[14px] text-[color:var(--ink-70)]">
              Whether attendees can add photos and download originals is set per album. Nothing is ever public: every
              photo needs a signed-in attendee.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold">Face search</h2>
            <FaceRecognition
              eventId={event.id}
              eventName={event.name}
              configured={facesConfigured()}
              enabled={Boolean(faceState?.enabled)}
              enrolledCount={enrolledCount ?? 0}
              backfill={faceBackfill}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold">Danger zone</h2>
            <DeleteEvent eventId={event.id} eventName={event.name} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="soft-card flex flex-col gap-3 p-5">
            <span className="text-[14px] font-medium">Logo</span>
            <span className="text-[14px] leading-normal text-[color:var(--ink-70)]">
              Shown in the header of every attendee screen, on the join page and on the poster. A square or wide PNG or
              SVG with a transparent background works best.
            </span>
            <LogoUploader eventId={event.id} logoUrl={logoUrl} />
          </section>

          <section id="deleted" className="soft-card flex scroll-mt-6 flex-col gap-2 p-5">
            <span className="text-[14px] font-medium">Recently deleted</span>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
              {binSummary.length
                ? `${binSummary.join(" and ")}. Restore anything deleted in the last 30 days.`
                : "Nothing deleted in the last 30 days. Deleted albums, photos and videos wait here for 30 days."}
            </p>
            <Link href={`/admin/${handle}/settings/deleted`} className="btn btn-sm btn-secondary self-start no-underline">
              Open Recently deleted
            </Link>
          </section>

          <section className="soft-card flex flex-col gap-2 p-5">
            <span className="text-[14px] font-medium">Event link</span>
            <code className="mono break-all text-[14px] text-[color:var(--kb-ink-2)]">{link}</code>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
              It never changes, even if you rename the event, so printed QR codes keep working.
            </p>
            <CopyButton value={link} label="Copy link" className="btn btn-sm btn-secondary self-start" />
          </section>
        </div>
      </div>
    </main>
  );
}

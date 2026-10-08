/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { BillingGate } from "@/components/BillingGate";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { formatDate } from "@/lib/format";
import { listStackedAlbums } from "@/lib/media/album-list";
import { createClient } from "@/lib/supabase/server";
import { NewAlbumPanel } from "./NewAlbumPanel";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage(props: PageProps<"/admin/[handle]/upload">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const recent = await listStackedAlbums(supabase, ctx.event.id, { includeDrafts: true, limit: 6 });
  const writable = canWrite(ctx.event);

  return (
    <main className="flex flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={ctx.event.name} title={recent.length ? "Upload" : "New album"}>
        {recent.length
          ? "Add to an album you have, or start a new one. Uploads keep going in the background."
          : "One album per part of the event works best: keynote, breakout sessions, drinks, headshots. Name it, choose when attendees see it, then upload. It keeps going in the background."}
      </PageTitle>

      {writable ? null : <BillingGate handle={handle} action="upload photos" />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {writable ? (
          <NewAlbumPanel eventId={ctx.event.id} defaultDate={ctx.event.starts_on} autoFocus={recent.length === 0} />
        ) : (
          <div />
        )}

        {/* On a phone the albums you have come first: most uploads go into one. */}
        <div className={`flex flex-col gap-5 ${recent.length ? "max-lg:order-first" : ""}`}>
          <section className="soft-card flex flex-col gap-3 p-5">
            <h2 className="text-[16px] font-semibold">{recent.length ? "Add to an album" : "Or add to an existing album"}</h2>
            {recent.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {recent.map((album) => (
                  <li key={album.id}>
                    <Link
                      href={`/e/${handle}/a/${album.id}?add=1`}
                      className="flex items-center gap-3 rounded-[8px] p-2 text-ink no-underline transition-colors hover:bg-[color:var(--kb-cream)]"
                    >
                      <span className="h-11 w-11 flex-none overflow-hidden rounded-[6px] bg-[color:var(--kb-sand)]">
                        {album.coverUrl ? <img src={album.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{album.title}</span>
                        <span className="block text-[14px] text-[color:var(--ink-70)]">
                          {(album.photoCount + album.videoCount).toLocaleString("en-AU")} files
                          {album.status === "published" ? ` · ${formatDate(album.date)}` : ""}
                        </span>
                      </span>
                      {album.status === "draft" ? <span className="soft-chip soft-chip-muted">Draft</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-[color:var(--ink-70)]">Nothing yet. The album you make here will be the first.</p>
            )}
          </section>

          <section className="kb-info flex-col">
            <span className="block text-[14px] font-semibold">What uploads well</span>
            <p className="m-0 text-[14px]">
              JPG, HEIC, PNG, WebP, MP4 and MOV at full resolution. We keep the original and make the web versions
              ourselves. Photographers without an account upload through their own link from Photographers.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

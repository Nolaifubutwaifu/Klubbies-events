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
  const recent = await listStackedAlbums(supabase, ctx.club.id, { includeDrafts: true, limit: 6 });
  const writable = canWrite(ctx.club.billing_status);

  return (
    <main className="flex flex-col gap-7 px-4 py-8 sm:px-6">
      <PageTitle kicker={ctx.club.name} title="New album">
        Drop the whole night in. Name it, say when it goes live, then upload — it keeps going in the background.
      </PageTitle>

      {writable ? null : <BillingGate handle={handle} action="upload photos" />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {writable ? <NewAlbumPanel clubId={ctx.club.id} /> : <div />}

        <div className="flex flex-col gap-5">
          <section className="soft-card flex flex-col gap-3 p-5">
            <h2 className="soft-display text-[18px]">Or add to one you already made</h2>
            {recent.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {recent.map((album) => (
                  <li key={album.id}>
                    <Link
                      href={`/c/${handle}/a/${album.id}?add=1`}
                      className="flex items-center gap-3 rounded-[16px] p-2 text-ink no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
                    >
                      <span className="h-11 w-11 flex-none overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]">
                        {album.coverUrl ? <img src={album.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold">{album.title}</span>
                        <span className="block text-[14px] text-[color:var(--ink-70)]">
                          {formatDate(album.date)} ·{" "}
                          {(album.photoCount + album.videoCount).toLocaleString("en-AU")} files
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

          <section className="rounded-[var(--soft-r)] bg-[color:var(--tone-support)] p-5 text-[color:var(--tone-support-ink)]">
            <span className="block text-[14px] font-bold">What uploads well</span>
            <p className="m-0 mt-1 text-[14px]">
              HEIC, JPG, PNG, WebP, MP4 and MOV, at whatever size your camera made them. We keep the original and make
              the small versions ourselves, so nobody has to export anything first.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

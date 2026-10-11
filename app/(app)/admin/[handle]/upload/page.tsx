import type { Metadata } from "next";
import { BillingGate } from "@/components/BillingGate";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { listStackedAlbums } from "@/lib/media/album-list";
import { createClient } from "@/lib/supabase/server";
import { UploadWorkbench } from "./UploadWorkbench";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage(props: PageProps<"/admin/[handle]/upload">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const recent = await listStackedAlbums(supabase, ctx.event.id, { includeDrafts: true });
  const writable = canWrite(ctx.event);

  return (
    <main className="flex flex-col gap-6">
      <PageTitle kicker={ctx.event.name} title="Upload">
        Full quality photos and videos. Uploads keep going while this tab is open. Photographers without an account upload
        through their own link from Photographers.
      </PageTitle>

      {writable ? null : <BillingGate handle={handle} action="upload photos" deletedAt={ctx.event.photos_deleted_at} />}

      <UploadWorkbench
        eventId={ctx.event.id}
        defaultDate={ctx.event.starts_on}
        writable={writable}
        albums={recent.map((album) => ({
          id: album.id,
          title: album.title,
          files: album.photoCount + album.videoCount,
          coverUrl: album.coverUrl,
          draft: album.status === "draft",
        }))}
      />
    </main>
  );
}

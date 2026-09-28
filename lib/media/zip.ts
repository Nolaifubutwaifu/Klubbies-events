import "server-only";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import { r2Stream } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

// Zips go out in parts so one request stays inside the function limits.
export const PART_SIZE = 150;

type ZipItem = { id: string; storage_path: string; original_filename: string | null; backed_up_at: string | null };

/**
 * Streams originals into a zip as they download. Callers pick the items with
 * the user's own client, so RLS has already decided what is visible; items
 * with a copy in R2 are read from there (no download charge), the rest are
 * signed through the caller's client, so storage RLS is the last word on them.
 */
export async function zipResponse(supabase: UserClient, media: ZipItem[], filename: string): Promise<NextResponse> {
  const urls = await signPaths(
    supabase,
    media.filter((m) => !m.backed_up_at).map((m) => m.storage_path),
    SIGNED_URL_TTL.download,
  );

  // Stored (not deflated): photos and video are already compressed.
  const archive = new ZipArchive({ store: true });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      archive.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      archive.on("end", () => controller.close());
      archive.on("warning", (error: unknown) => console.error("zip warning", error));
      archive.on("error", (error: unknown) => controller.error(error));

      void (async () => {
        const used = new Set<string>();
        for (const item of media) {
          let body = await r2Stream(item);
          if (!body) {
            const url = urls.get(item.storage_path) ?? (await signPaths(supabase, [item.storage_path], SIGNED_URL_TTL.download)).get(item.storage_path);
            if (!url) continue;
            const response = await fetch(url);
            if (!response.ok || !response.body) continue;
            body = response.body;
          }

          const fallback = item.storage_path.split("/").pop() ?? `${item.id}.jpg`;
          let name = item.original_filename?.replace(/[/\\]/g, "-") || fallback;
          if (used.has(name)) name = `${item.id.slice(0, 8)}-${name}`;
          used.add(name);

          archive.append(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), { name });
        }
        await archive.finalize();
      })().catch((error) => {
        console.error("zip failed", error);
        archive.abort();
      });
    },
    cancel() {
      archive.abort();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}

export function safeFilename(title: string, fallback: string): string {
  return title.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || fallback;
}

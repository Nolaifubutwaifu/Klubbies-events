import "server-only";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import { r2Stream } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

import { ZIP_PART_SIZE } from "./zip-parts";

export const PART_SIZE = ZIP_PART_SIZE;

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
        const missing: string[] = [];
        for (const item of media) {
          const fallback = item.storage_path.split("/").pop() ?? `${item.id}.jpg`;
          let body = await r2Stream(item);
          if (!body) {
            const url = urls.get(item.storage_path) ?? (await signPaths(supabase, [item.storage_path], SIGNED_URL_TTL.download)).get(item.storage_path);
            const response = url ? await fetch(url).catch(() => null) : null;
            if (!response?.ok || !response.body) {
              missing.push(item.original_filename || fallback);
              continue;
            }
            body = response.body;
          }

          let name = item.original_filename?.replace(/[/\\]/g, "-") || fallback;
          if (used.has(name)) name = `${item.id.slice(0, 8)}-${name}`;
          used.add(name);

          archive.append(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), { name });
        }
        // A zip that quietly comes up short looks complete; say what's missing.
        if (missing.length) {
          const note = `These ${missing.length} file(s) couldn't be added to this zip. Try downloading them one at a time from the album, or download this zip again later.\n\n${missing.join("\n")}\n`;
          archive.append(Buffer.from(note, "utf8"), { name: "missing.txt" });
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

export const UNAVAILABLE =
  "This download isn't available to you. You may need to sign in with the email the organiser has, or the album was removed.";

/**
 * Download links are opened as pages (from emails, from the share sheet), so
 * a failure answers with a readable page there and JSON for scripts.
 */
export function zipError(request: Request, message: string, status: number): NextResponse {
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return NextResponse.json({ error: message }, { status });
  const safe = message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Download not available</title><style>body{font-family:system-ui,sans-serif;background:#f7f6f3;color:#16181d;margin:0;padding:48px 20px;line-height:1.5}main{max-width:440px;margin:0 auto}h1{font-size:22px;margin:0 0 8px}a{color:#2b4acb}</style></head><body><main><h1>Download not available</h1><p>${safe}</p><p><a href="/events">Back to your events</a></p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

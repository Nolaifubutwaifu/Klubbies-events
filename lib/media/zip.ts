import "server-only";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import { r2Stream } from "@/lib/backup/r2";
import { SIGNED_URL_TTL, mediaClaims, signPaths } from "@/lib/storage";
import type { UserClient } from "@/lib/supabase/server";

import { ZIP_PART_SIZE, zipLookahead } from "./zip-parts";

export const PART_SIZE = ZIP_PART_SIZE;



type ZipItem = {
  id: string;
  event_id: string;
  album_id: string | null;
  storage_path: string;
  original_filename: string | null;
  backed_up_at: string | null;
  byte_size?: number | null;
};

/**
 * Streams originals into a zip as they download. Callers pick the items with
 * the user's own client, so RLS has already decided what is visible; items
 * with a copy in R2 are read from there (no download charge), the rest are
 * signed for paths on those rows.
 *
 * The archive is piped through a stream the response reads. A slow phone
 * pauses that stream, which pauses the archive. Files are written one at a
 * time, but the next LOOKAHEAD are already requested: each storage request
 * costs a round trip before its first byte, and paid one after another that
 * wait made a part of 150 small photos crawl (2 MB/s on 18 Nov). An opened
 * file holds only its socket buffer until its turn.
 */
export async function zipResponse(supabase: UserClient, media: ZipItem[], filename: string): Promise<NextResponse> {
  const urls = await signPaths(
    supabase,
    mediaClaims(media.filter((m) => !m.backed_up_at).map((m) => ({ ...m, paths: [m.storage_path] }))),
    SIGNED_URL_TTL.download,
  );

  // Stored (not deflated): photos and video are already compressed.
  // A small high water mark so a paused phone is not sitting on megabytes.
  const archive = new ZipArchive({ store: true, highWaterMark: 64 * 1024 });
  const pass = new PassThrough({ highWaterMark: 64 * 1024 });
  archive.pipe(pass);

  let finished = false;
  archive.on("end", () => {
    finished = true;
  });
  archive.on("warning", (error: unknown) => console.error("zip warning", error));
  pass.on("close", () => {
    if (!finished) archive.abort();
  });

  /** The file's bytes from R2, or from Supabase when it has no copy there yet. */
  const open = async (item: ZipItem): Promise<ReadableStream<Uint8Array> | null> => {
    const fromR2 = await r2Stream(item);
    if (fromR2) return fromR2;
    const again = mediaClaims([{ ...item, paths: [item.storage_path] }]);
    const url = urls.get(item.storage_path) ?? (again.length ? (await signPaths(supabase, again, SIGNED_URL_TTL.download)).get(item.storage_path) : undefined);
    const response = url ? await fetch(url).catch(() => null) : null;
    return response?.ok && response.body ? response.body : null;
  };
  const opened = new Map<number, Promise<ReadableStream<Uint8Array> | null>>();
  const start = (i: number) => {
    if (i < media.length && !opened.has(i)) opened.set(i, open(media[i]).catch(() => null));
  };

  void (async () => {
    const used = new Set<string>();
    const missing: string[] = [];
    try {
      for (let i = 0; i < media.length; i++) {
        for (const index of zipLookahead(media.map((m) => m.byte_size), i)) start(index);
        const body = await opened.get(i)!;
        opened.delete(i);
        const item = media[i];
        const fallback = item.storage_path.split("/").pop() ?? `${item.id}.jpg`;
        if (!body) {
          missing.push(item.original_filename || fallback);
          continue;
        }

        let name = item.original_filename?.replace(/[/\\]/g, "-") || fallback;
        if (used.has(name)) name = `${item.id.slice(0, 8)}-${name}`;
        used.add(name);

        await appendEntry(archive, Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), name);
      }
    } finally {
      // A phone that gave up leaves files requested ahead: close them.
      for (const pending of opened.values()) void pending.then((body) => body?.cancel().catch(() => {}));
    }
    // A zip that quietly comes up short looks complete; say what's missing.
    if (missing.length) {
      const note = `These ${missing.length} file(s) couldn't be added to this zip. Try downloading them one at a time from the album, or download this zip again later.\n\n${missing.join("\n")}\n`;
      await appendEntry(archive, Buffer.from(note, "utf8"), "missing.txt");
    }
    await archive.finalize();
  })().catch((error) => {
    console.error("zip failed", error);
    archive.abort();
    pass.destroy();
  });

  const stream = Readable.toWeb(pass) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}

/** Resolves once this entry has been written into the archive, so the next file is not fetched early. */
function appendEntry(archive: ZipArchive, source: Readable | Buffer, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      archive.off("entry", onEntry);
      archive.off("error", onError);
      if (error) reject(error instanceof Error ? error : new Error(String(error)));
      else resolve();
    };
    const onEntry = () => finish();
    const onError = (error: unknown) => finish(error);
    archive.once("entry", onEntry);
    archive.once("error", onError);
    archive.append(source, { name });
  });
}

/** Part 1 is named as a part whenever the download is split, so the phone doesn't save two files as the same "Album.zip". */
export function zipPartFilename(title: string, part: number, partCount: number): string {
  if (partCount > 1) return `${title} (part ${part + 1}).zip`;
  return `${title}.zip`;
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

import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { logAccess } from "@/lib/media/access";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

// Pro's ceiling. A part of full quality photos and video is slow to stream on
// a weak connection, and a zip cut off at 300s arrives corrupt.
export const maxDuration = 800;

// Albums are zipped in parts so one request stays inside the function limits.
export const PART_SIZE = 150;

export async function GET(request: Request, ctx: RouteContext<"/api/albums/[id]/zip">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const part = Math.max(0, Number(params.get("part") ?? 0));
  // "Download these" on the Saved screen asks for a specific handful rather
  // than the whole album, so the zip is just their favourites.
  const only = (params.get("only") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => z.uuid().safeParse(value).success)
    .slice(0, PART_SIZE);

  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, club_id, title, allow_download").eq("id", id).maybeSingle();
  if (!album) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const club = await getClubContextById(album.club_id);
  if (!club) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!album.allow_download && !club.perms.manage_albums) {
    return NextResponse.json({ error: "Downloads are turned off for this album" }, { status: 403 });
  }

  let query = supabase
    .from("media")
    .select("id, storage_path, original_filename, sort_at")
    .eq("album_id", album.id)
    .eq("status", "ready")
    .order("sort_at", { ascending: true })
    .order("id", { ascending: true });
  query = only.length ? query.in("id", only) : query.range(part * PART_SIZE, (part + 1) * PART_SIZE - 1);
  const { data: media } = await query;
  if (!media?.length) return NextResponse.json({ error: "Nothing to download" }, { status: 404 });

  const urls = await signPaths(
    supabase,
    media.map((m) => m.storage_path),
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
          const url = urls.get(item.storage_path);
          if (!url) continue;
          const response = await fetch(url);
          if (!response.ok || !response.body) continue;

          const fallback = item.storage_path.split("/").pop() ?? `${item.id}.jpg`;
          let name = item.original_filename?.replace(/[/\\]/g, "-") || fallback;
          if (used.has(name)) name = `${item.id.slice(0, 8)}-${name}`;
          used.add(name);

          archive.append(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), { name });
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

  await logAccess(club, null, "zip");

  const safeTitle = album.title.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "album";
  const filename = only.length
    ? `${safeTitle} (favourites).zip`
    : part > 0
      ? `${safeTitle} (part ${part + 1}).zip`
      : `${safeTitle}.zip`;

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

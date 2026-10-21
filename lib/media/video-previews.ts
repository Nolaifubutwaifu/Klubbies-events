import "server-only";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { r2Url } from "@/lib/backup/r2";
import { BUCKET, derivativePaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 3;
const PER_RUN = 6;
// Same sizes the uploader makes in the browser (lib/media/prepare.ts).
const DISPLAY_EDGE = 2000;
const THUMB_SHORT_EDGE = 400;
const THUMB_LONG_CAP = 900;

type Frame = { jpeg: Buffer; durationSeconds: number | null };

/**
 * One frame and the length, read straight from the stored file over HTTPS.
 * ffmpeg seeks with range requests, so a 70 MB clip isn't downloaded whole,
 * and it applies the phone's rotation, so the frame comes out upright.
 */
export function grabFrame(url: string, atSeconds: number): Promise<Frame> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available"));
    const ff = spawn(
      ffmpegPath,
      ["-hide_banner", "-loglevel", "info", "-ss", String(atSeconds), "-i", url, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "3", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => ff.kill("SIGKILL"), 60_000);
    ff.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    ff.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    ff.on("error", reject);
    ff.on("close", () => {
      clearTimeout(timer);
      const match = err.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      const durationSeconds = match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
      const jpeg = Buffer.concat(out);
      if (jpeg.length === 0) return reject(new Error(err.split("\n").slice(-3).join(" ").slice(0, 300) || "no frame"));
      resolve({ jpeg, durationSeconds });
    });
  });
}

/**
 * The hourly backstop for videos that arrived without a poster, size or
 * length (most iPhone HEVC clips uploaded from a laptop). Returns how many
 * got one.
 */
export async function runVideoPreviewBackfill(budgetMs: number): Promise<number> {
  const deadline = Date.now() + budgetMs;
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("media")
    .select("id, storage_path, backed_up_at, width, height, duration_seconds, preview_attempts")
    .eq("kind", "video")
    .eq("status", "ready")
    .is("poster_path", null)
    .is("deleted_at", null)
    .lt("preview_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(PER_RUN);
  if (error) throw error;

  let made = 0;
  for (const row of rows ?? []) {
    if (Date.now() > deadline) break;
    await admin.from("media").update({ preview_attempts: row.preview_attempts + 1 }).eq("id", row.id);
    try {
      const url =
        (await r2Url(row, 600)) ??
        (await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, 600)).data?.signedUrl ??
        null;
      if (!url) throw new Error("no readable copy");
      // A second in, past any black first frame; very short clips start at 0.
      const frame = await grabFrame(url, 1).catch(() => grabFrame(url, 0));
      const image = sharp(frame.jpeg);
      const { width, height } = await image.metadata();
      if (!width || !height) throw new Error("frame has no size");

      const scaleDisplay = Math.min(1, DISPLAY_EDGE / Math.max(width, height));
      const scaleThumb = Math.min(1, THUMB_SHORT_EDGE / Math.min(width, height), THUMB_LONG_CAP / Math.max(width, height));
      const [poster, thumb] = await Promise.all([
        image.clone().resize(Math.round(width * scaleDisplay), Math.round(height * scaleDisplay)).jpeg({ quality: 85 }).toBuffer(),
        image.clone().resize(Math.round(width * scaleThumb), Math.round(height * scaleThumb)).webp({ quality: 80 }).toBuffer(),
      ]);

      const folder = row.storage_path.slice(0, row.storage_path.lastIndexOf("/"));
      const paths = derivativePaths(folder);
      const storage = admin.storage.from(BUCKET);
      const uploads = await Promise.all([
        storage.upload(paths.poster, poster, { upsert: true, contentType: "image/jpeg" }),
        storage.upload(paths.thumb, thumb, { upsert: true, contentType: "image/webp" }),
      ]);
      const failed = uploads.find((u) => u.error);
      if (failed?.error) throw failed.error;

      await admin
        .from("media")
        .update({
          poster_path: paths.poster,
          thumb_path: paths.thumb,
          width: row.width ?? width,
          height: row.height ?? height,
          duration_seconds: row.duration_seconds ?? frame.durationSeconds,
        })
        .eq("id", row.id);
      made += 1;
    } catch (error) {
      console.error("video preview failed", row.id, error);
    }
  }
  return made;
}

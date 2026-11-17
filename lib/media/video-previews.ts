import "server-only";
import { spawn } from "node:child_process";
import { after } from "next/server";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { r2Url } from "@/lib/backup/r2";
import { sharpDecodeOptions } from "@/lib/media/logo-file";
import { BUCKET, derivativePaths } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { withWorkerLease } from "@/lib/worker-lease";

const MAX_ATTEMPTS = 3;
/**
 * Videos one pass will start. A frame is a short range-read, so twenty fit
 * in the cron's two minutes; the deadline stops the pass if one runs long.
 * Was six, which left a night of phone videos waiting on later hours.
 */
export const VIDEO_PREVIEW_PER_RUN = 20;
/** Hourly slice. The cron's whole budget is 300s; this stays inside what is left. */
export const VIDEO_PREVIEW_CRON_BUDGET_MS = 120_000;
/** After an upload: long enough for the video just finished, not a backlog. */
export const VIDEO_PREVIEW_KICK_BUDGET_MS = 70_000;
/** One range-seek. A 200 MB original is not downloaded, so this stays under the kick. */
export const GRAB_FRAME_TIMEOUT_MS = 60_000;
// Same sizes the uploader makes in the browser (lib/media/prepare.ts).
const DISPLAY_EDGE = 2000;
const THUMB_SHORT_EDGE = 400;
const THUMB_LONG_CAP = 900;

type Frame = { jpeg: Buffer; durationSeconds: number | null };

/**
 * One frame and the length, read straight from the stored file over HTTPS.
 * ffmpeg seeks with range requests, so a 200 MB clip is not downloaded whole
 * and is not held in memory: only the JPEG frame is. The 60s kill is for the
 * seek, and it still fits inside the kick budget. ffmpeg also applies the
 * phone's rotation, so the frame comes out upright.
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
    const timer = setTimeout(() => ff.kill("SIGKILL"), GRAB_FRAME_TIMEOUT_MS);
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
 * Posters, sizes and lengths for videos the browser could not read (most
 * iPhone HEVC clips uploaded from a laptop). The hourly cron is the backstop.
 * Finalize also calls kickVideoPreviews so a clip is not waiting up to an hour.
 * One pass runs at a time (migration 039); a second caller leaves the rows
 * queued. Returns how many got a preview.
 */
export async function runVideoPreviewBackfill(budgetMs: number): Promise<number> {
  const outcome = await withWorkerLease("video_preview", (renew) => fillVideoPreviews(budgetMs, renew));
  if (outcome === "busy") {
    console.log("video preview backfill already running");
    return 0;
  }
  return outcome;
}

/** After a video lands without a poster or a length. Never throws. */
export function kickVideoPreviews(): void {
  const drain = () =>
    runVideoPreviewBackfill(VIDEO_PREVIEW_KICK_BUDGET_MS)
      .then((made) => {
        if (made) console.log(`video preview kick made ${made}`);
      })
      .catch((error) => console.error("video preview kick failed", error));
  try {
    after(drain);
  } catch {
    void drain();
  }
}

async function fillVideoPreviews(budgetMs: number, renew: () => Promise<boolean>): Promise<number> {
  const deadline = Date.now() + budgetMs;
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("media")
    .select("id, storage_path, backed_up_at, width, height, duration_seconds, preview_attempts")
    .eq("kind", "video")
    .eq("status", "ready")
    .is("deleted_at", null)
    .or("poster_path.is.null,duration_seconds.is.null")
    .lt("preview_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(VIDEO_PREVIEW_PER_RUN);
  if (error) throw error;

  let made = 0;
  for (const row of rows ?? []) {
    if (Date.now() > deadline) break;
    if (!(await renew())) break;
    await admin.from("media").update({ preview_attempts: row.preview_attempts + 1 }).eq("id", row.id);
    try {
      const url =
        (await r2Url(row, 600)) ??
        (await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, 600)).data?.signedUrl ??
        null;
      if (!url) throw new Error("no readable copy");
      // A second in, past any black first frame; very short clips start at 0.
      const frame = await grabFrame(url, 1).catch(() => grabFrame(url, 0));
      const image = sharp(frame.jpeg, sharpDecodeOptions);
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

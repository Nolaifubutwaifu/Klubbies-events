import { Upload } from "tus-js-client";
import { contentHash } from "@/lib/media/content-hash";
import { UPLOAD_MAX_BYTES, VIDEO_TOO_BIG, resolveMimeType, tooBigWarning } from "@/lib/media/constants";
import { prepareVideo, preparePhoto, type Prepared } from "@/lib/media/prepare";
import { putSignedObject } from "@/lib/media/signed-put";
import { isUploadRetryable, postJson, withBackoff } from "@/lib/retry";
import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/config";

// Client-side upload queue: prepares derivatives, uploads originals with
// resumable TUS straight to Supabase Storage (the Next server never proxies
// bytes), then finalises. One failed file never blocks the rest.
//
// Two lanes, so the connection never waits on the browser: a few files are
// prepared ahead (thumbnail, preview, fingerprint) while up to six others
// upload. With preparing inside the upload slots, a 14 GB batch used about a
// third of a 27 Mbit/s line.

type Ticket = {
  /** The album already has this exact file: nothing to upload. */
  duplicate?: boolean;
  mediaId: string;
  kind: "photo" | "video";
  bucket: string;
  mimeType: string;
  storagePath: string;
  derivatives: { thumb: string; display: string; poster: string };
  /** Signed PUTs for the derivatives, issued after the ticket was authorised. */
  signed?: Record<string, { signedUrl: string }>;
};

export type JobStatus = "queued" | "preparing" | "uploading" | "finishing" | "done" | "failed";

type Job = {
  key: string;
  file: File;
  mimeType: string;
  status: JobStatus;
  uploaded: number;
  error?: string;
  note?: string;
  previewUrl?: string;
  prepared?: Prepared;
  hash?: string | null;
  ticket?: Ticket;
  originalDone?: boolean;
  tus?: Upload;
};

export type JobView = Readonly<{
  key: string;
  name: string;
  size: number;
  status: JobStatus;
  uploaded: number;
  error?: string;
  /** Set when a file was skipped rather than uploaded, and why. */
  note?: string;
  previewUrl?: string;
}>;

/** Files uploading at once. */
const UPLOADS_AT_ONCE = 6;
/** Of those, videos: each can be hundreds of MB, and preparing one holds it in memory. */
const VIDEOS_AT_ONCE = 2;
/** Files being prepared at once: decoding and resizing is the browser's heavy work. */
const PREPARING_AT_ONCE = 2;
/** Prepared files waiting for an upload slot, at most, so memory stays flat on a big batch. */
const PREPARED_AHEAD = 6;
const CHUNK_SIZE = 6 * 1024 * 1024; // Supabase requires exactly 6 MB chunks
const RESUMABLE_ENDPOINT = `${supabaseUrl.replace(".supabase.co", ".storage.supabase.co")}/storage/v1/upload/resumable`;

function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/413|too large|maximum allowed size/i.test(text)) return VIDEO_TOO_BIG;
  if (/401|403|jwt|unauthor/i.test(text)) return "Your session expired. Refresh the page and retry.";
  if (/network|failed to fetch|offline/i.test(text)) return "Connection lost. Retry when you're back online.";
  return text.slice(0, 160);
}

export const EMPTY_SNAPSHOT: readonly JobView[] = [];

export class UploadQueue {
  private jobs = new Map<string, Job>();
  private listeners = new Set<() => void>();
  private uploading = 0;
  private uploadingVideos = 0;
  private preparing = 0;
  private snapshot: readonly JobView[] = EMPTY_SNAPSHOT;
  private supabase = createClient();

  constructor(
    private readonly albumId: string,
    private readonly onIdle: () => void,
    /** Each file that lands in the album, so the grid can show it straight away. */
    private readonly onItemDone: () => void = () => {},
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  add(files: File[]): { rejected: string[]; warnings: string[] } {
    const rejected: string[] = [];
    const warnings: string[] = [];
    for (const file of files) {
      const mimeType = resolveMimeType(file.name, file.type);
      if (!mimeType) {
        rejected.push(file.name);
        continue;
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        warnings.push(tooBigWarning(file.name));
        continue;
      }
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
      this.jobs.set(key, { key, file, mimeType, status: "queued", uploaded: 0 });
    }
    this.pump();
    return { rejected, warnings };
  }

  retry(key: string) {
    const job = this.jobs.get(key);
    if (!job || job.status !== "failed") return;
    // A ticket from a stalled upload may have expired. A fresh one carries on
    // in the same row (matched by content), so nothing is uploaded twice.
    // Drop derivative URLs: they are short-lived, and a retry after a long
    // video may find them expired. The ticket row itself is reused.
    const ticket = job.originalDone && job.ticket ? { ...job.ticket, signed: undefined } : undefined;
    this.patch(job, { status: "queued", error: undefined, ticket });
    this.pump();
  }

  retryFailed() {
    for (const job of this.jobs.values()) if (job.status === "failed") this.retry(job.key);
  }

  /** Gives up on every failed file: they leave the list (the server already knows they failed). */
  clearFailed() {
    for (const [key, job] of this.jobs) {
      if (job.status !== "failed") continue;
      if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
      this.jobs.delete(key);
    }
    this.emit();
    if (![...this.jobs.values()].some((j) => j.status !== "done" && j.status !== "failed")) this.onIdle();
  }

  private emit() {
    this.snapshot = [...this.jobs.values()].map((j) => ({
      key: j.key,
      name: j.file.name,
      size: j.file.size,
      status: j.status,
      uploaded: j.uploaded,
      error: j.error,
      note: j.note,
      previewUrl: j.previewUrl,
    }));
    for (const listener of this.listeners) listener();
  }

  /** The event's photo allowance is used up: nothing still waiting will get in either. */
  private stopQueued(message: string) {
    for (const job of this.jobs.values()) {
      if (job.status === "queued") this.patch(job, { status: "failed", error: message });
    }
  }

  private patch(job: Job, changes: Partial<Job>) {
    Object.assign(job, changes);
    this.emit();
  }

  private isVideo(job: Job) {
    return job.mimeType.startsWith("video/");
  }

  /** Prepared and fingerprinted, waiting for an upload slot. */
  private isReady(job: Job) {
    return job.status === "queued" && job.prepared !== undefined && job.hash !== undefined;
  }

  private settle() {
    const busy = [...this.jobs.values()].some((j) => j.status !== "done" && j.status !== "failed");
    if (!busy) this.onIdle();
    this.pump();
  }

  private pump() {
    // Upload lane: everything prepared, in order, videos two at a time.
    for (const job of this.jobs.values()) {
      if (this.uploading >= UPLOADS_AT_ONCE) break;
      if (!this.isReady(job)) continue;
      const video = this.isVideo(job);
      if (video && this.uploadingVideos >= VIDEOS_AT_ONCE) continue;
      this.uploading++;
      if (video) this.uploadingVideos++;
      job.status = "uploading";
      void this.send(job).finally(() => {
        this.uploading--;
        if (video) this.uploadingVideos--;
        this.settle();
      });
    }

    // Prepare lane: keep the next few ready. Videos held back by their limit
    // don't count, so photos behind them still get prepared and sent.
    const videosFull = this.uploadingVideos >= VIDEOS_AT_ONCE;
    let ahead = [...this.jobs.values()].filter((j) => this.isReady(j) && !(videosFull && this.isVideo(j))).length;
    for (const job of this.jobs.values()) {
      if (this.preparing >= PREPARING_AT_ONCE || ahead + this.preparing >= PREPARED_AHEAD) break;
      if (job.status !== "queued" || this.isReady(job)) continue;
      this.preparing++;
      ahead++;
      job.status = "preparing";
      void this.prepare(job).finally(() => {
        this.preparing--;
        this.settle();
      });
    }
    this.emit();
  }

  private uploadOriginal(job: Job, ticket: Ticket) {
    return new Promise<void>((resolve, reject) => {
      const upload =
        job.tus ??
        new Upload(job.file, {
          endpoint: RESUMABLE_ENDPOINT,
          chunkSize: CHUNK_SIZE,
          retryDelays: [0, 2000, 5000, 10000, 20000],
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          storeFingerprintForResuming: false,
          metadata: {
            bucketName: ticket.bucket,
            objectName: ticket.storagePath,
            contentType: ticket.mimeType,
            cacheControl: "3600",
          },
          onBeforeRequest: async (req) => {
            const { data } = await this.supabase.auth.getSession();
            req.setHeader("authorization", `Bearer ${data.session?.access_token ?? ""}`);
            req.setHeader("x-upsert", "true");
          },
          onProgress: (sent) => this.patch(job, { uploaded: sent }),
        });
      upload.options.onSuccess = () => resolve();
      upload.options.onError = (err) => reject(err);
      job.tus = upload;
      upload.start();
    });
  }

  /** Thumbnail, preview and fingerprint, ahead of the upload. */
  private async prepare(job: Job) {
    try {
      this.patch(job, { status: "preparing", error: undefined });
      const prepared =
        job.prepared ?? (this.isVideo(job) ? await prepareVideo(job.file) : await preparePhoto(job.file, job.mimeType));
      if (job.hash === undefined) job.hash = await contentHash(job.file);
      this.patch(job, {
        prepared,
        status: "queued",
        previewUrl: job.previewUrl ?? (prepared.thumb ? URL.createObjectURL(prepared.thumb) : undefined),
      });
    } catch (error) {
      this.patch(job, { status: "failed", error: friendlyError(error) });
    }
  }

  /** A fresh ticket, including signed derivative URLs. "duplicate" means the album already has the file. */
  private async requestTicket(job: Job): Promise<Ticket | "duplicate"> {
    const res = await postJson("/api/media/upload_ticket", {
      albumId: this.albumId,
      filename: job.file.name,
      mimeType: job.mimeType,
      byteSize: job.file.size,
      contentHash: job.hash,
    });
    const body: Ticket & { error?: string; full?: boolean } = await res.json();
    if (res.status === 409 && body.full) this.stopQueued(body.error ?? "This event is full.");
    if (!res.ok || body.error) throw new Error(body.error ?? "Could not start the upload");
    if (body.duplicate) return "duplicate";
    return body;
  }

  /** Ticket, original, derivatives, finalise: the network half. */
  private async send(job: Job) {
    const prepared = job.prepared!;
    try {
      this.patch(job, { status: "uploading", error: undefined });
      let ticket = job.ticket;
      if (!ticket) {
        const issued = await this.requestTicket(job);
        if (issued === "duplicate") {
          this.patch(job, { status: "done", uploaded: job.file.size, note: "Already in this album" });
          return;
        }
        ticket = issued;
        this.patch(job, { ticket });
      }

      if (!job.originalDone) {
        await this.uploadOriginal(job, ticket);
        this.patch(job, { originalDone: true, uploaded: job.file.size });
      }

      this.patch(job, { status: "finishing" });
      const derivatives: [string, Blob | null][] = [
        [ticket.derivatives.thumb, prepared.thumb],
        [ticket.derivatives.display, prepared.display],
        [ticket.derivatives.poster, prepared.poster],
      ];
      if (derivatives.some(([, blob]) => blob) && !ticket.signed) {
        const refreshed = await this.requestTicket(job);
        if (refreshed === "duplicate") {
          this.patch(job, { status: "done", uploaded: job.file.size, note: "Already in this album" });
          return;
        }
        ticket = refreshed;
        this.patch(job, { ticket });
      }
      for (const [path, blob] of derivatives) {
        if (!blob) continue;
        const signedUrl = ticket.signed?.[path]?.signedUrl;
        await withBackoff(async () => {
          if (signedUrl) {
            await putSignedObject(signedUrl, blob, blob.type || "image/webp");
            return;
          }
          // A ticket from before signed URLs existed still uploads with the session.
          const { error } = await this.supabase.storage.from(ticket.bucket).upload(path, blob, {
            upsert: true,
            contentType: blob.type || "image/webp",
          });
          if (error) throw error;
        }, isUploadRetryable);
      }

      const res = await postJson(`/api/media/${ticket.mediaId}/finalize`, {
        width: prepared.width,
        height: prepared.height,
        durationSeconds: prepared.durationSeconds,
        capturedAt: prepared.capturedAt,
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not finish the upload");
      }
      this.patch(job, { status: "done" });
      this.onItemDone();
    } catch (error) {
      this.patch(job, { status: "failed", error: friendlyError(error) });
      // Tell the server, so the row stops showing as "processing" to guests
      // and stops counting against the allowance. Upload again revives it.
      if (job.ticket && !job.ticket.duplicate) {
        void fetch(`/api/media/${job.ticket.mediaId}/finalize`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ width: null, height: null, durationSeconds: null, capturedAt: null, failed: true }),
          keepalive: true,
        }).catch(() => undefined);
      }
    }
  }
}

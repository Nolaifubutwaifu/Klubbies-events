import { Upload } from "tus-js-client";
import { contentHash } from "@/lib/media/content-hash";
import { LARGE_VIDEO_BYTES, resolveMimeType } from "@/lib/media/constants";
import { prepareVideo, preparePhoto, type Prepared } from "@/lib/media/prepare";
import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/config";

// Client-side upload queue: prepares derivatives, uploads originals with
// resumable TUS straight to Supabase Storage (the Next server never proxies
// bytes), then finalises. One failed file never blocks the rest.

type Ticket = {
  /** The album already has this exact file: nothing to upload. */
  duplicate?: boolean;
  mediaId: string;
  kind: "photo" | "video";
  bucket: string;
  mimeType: string;
  storagePath: string;
  derivatives: { thumb: string; display: string; poster: string };
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

const CONCURRENCY = 3;
const CHUNK_SIZE = 6 * 1024 * 1024; // Supabase requires exactly 6 MB chunks
const RESUMABLE_ENDPOINT = `${supabaseUrl.replace(".supabase.co", ".storage.supabase.co")}/storage/v1/upload/resumable`;

function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/413|too large|maximum allowed size/i.test(text)) return "This file is larger than your storage plan allows per file.";
  if (/401|403|jwt|unauthor/i.test(text)) return "Your session expired. Refresh the page and retry.";
  if (/network|failed to fetch|offline/i.test(text)) return "Connection lost. Retry when you're back online.";
  return text.slice(0, 160);
}

export const EMPTY_SNAPSHOT: readonly JobView[] = [];

export class UploadQueue {
  private jobs = new Map<string, Job>();
  private listeners = new Set<() => void>();
  private active = 0;
  private snapshot: readonly JobView[] = EMPTY_SNAPSHOT;
  private supabase = createClient();

  constructor(
    private readonly albumId: string,
    private readonly onIdle: () => void,
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
      if (mimeType.startsWith("video/") && file.size > LARGE_VIDEO_BYTES) {
        warnings.push(`${file.name} is over 500 MB. It will upload, but members on mobile data may struggle to play it.`);
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
    this.patch(job, { status: "queued", error: undefined });
    this.pump();
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

  private patch(job: Job, changes: Partial<Job>) {
    Object.assign(job, changes);
    this.emit();
  }

  private pump() {
    for (const job of this.jobs.values()) {
      if (this.active >= CONCURRENCY) break;
      if (job.status !== "queued") continue;
      this.active++;
      job.status = "preparing";
      void this.process(job).finally(() => {
        this.active--;
        const busy = [...this.jobs.values()].some((j) => j.status !== "done" && j.status !== "failed");
        if (!busy) this.onIdle();
        this.pump();
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

  private async process(job: Job) {
    try {
      this.patch(job, { status: "preparing", error: undefined });
      const prepared =
        job.prepared ?? (job.mimeType.startsWith("video/") ? await prepareVideo(job.file) : await preparePhoto(job.file, job.mimeType));
      this.patch(job, { prepared, previewUrl: job.previewUrl ?? (prepared.thumb ? URL.createObjectURL(prepared.thumb) : undefined) });

      let ticket = job.ticket;
      if (!ticket) {
        if (job.hash === undefined) job.hash = await contentHash(job.file);
        const res = await fetch("/api/media/upload_ticket", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            albumId: this.albumId,
            filename: job.file.name,
            mimeType: job.mimeType,
            byteSize: job.file.size,
            contentHash: job.hash,
          }),
        });
        const body: Ticket & { error?: string } = await res.json();
        if (!res.ok || body.error) throw new Error(body.error ?? "Could not start the upload");
        if (body.duplicate) {
          this.patch(job, { status: "done", uploaded: job.file.size, note: "Already in this album" });
          return;
        }
        ticket = body;
        this.patch(job, { ticket });
      }

      if (!job.originalDone) {
        this.patch(job, { status: "uploading" });
        await this.uploadOriginal(job, ticket);
        this.patch(job, { originalDone: true, uploaded: job.file.size });
      }

      this.patch(job, { status: "finishing" });
      const storage = this.supabase.storage.from(ticket.bucket);
      const derivatives: [string, Blob | null][] = [
        [ticket.derivatives.thumb, prepared.thumb],
        [ticket.derivatives.display, prepared.display],
        [ticket.derivatives.poster, prepared.poster],
      ];
      for (const [path, blob] of derivatives) {
        if (!blob) continue;
        const { error } = await storage.upload(path, blob, { upsert: true, contentType: blob.type || "image/webp" });
        if (error) throw error;
      }

      const res = await fetch(`/api/media/${ticket.mediaId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          width: prepared.width,
          height: prepared.height,
          durationSeconds: prepared.durationSeconds,
          capturedAt: prepared.capturedAt,
        }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not finish the upload");
      }
      this.patch(job, { status: "done" });
    } catch (error) {
      this.patch(job, { status: "failed", error: friendlyError(error) });
    }
  }
}

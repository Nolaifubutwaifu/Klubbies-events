import { contentHash } from "@/lib/media/content-hash";
import { LARGE_VIDEO_BYTES, resolveMimeType } from "@/lib/media/constants";
import { prepareVideo, preparePhoto, type Prepared } from "@/lib/media/prepare";
import { supabaseUrl } from "@/lib/supabase/config";

// The guest version of the upload queue. Same shape as the member one, minus
// everything that needs a session: no TUS (which signs each chunk with a JWT),
// no resume across tabs. The server hands out one signed URL per object and
// the browser PUTs straight to storage.

export type GuestJobStatus = "queued" | "preparing" | "uploading" | "finishing" | "done" | "failed";

export type GuestJobView = Readonly<{
  key: string;
  name: string;
  size: number;
  status: GuestJobStatus;
  progress: number;
  error?: string;
  previewUrl?: string;
}>;

type Signed = { path: string; token: string };

type Ticket = {
  /** The album already has this exact file: nothing to upload. */
  duplicate?: boolean;
  mediaId: string;
  bucket: string;
  mimeType: string;
  storagePath: string;
  derivatives: { thumb: string; display: string; poster: string };
  signed: Record<string, Signed>;
};

type Job = {
  key: string;
  file: File;
  mimeType: string;
  status: GuestJobStatus;
  progress: number;
  error?: string;
  previewUrl?: string;
  prepared?: Prepared;
  hash?: string | null;
  ticket?: Ticket;
  originalDone?: boolean;
};

const CONCURRENCY = 2;

export const EMPTY_GUEST_SNAPSHOT: readonly GuestJobView[] = [];

function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/413|too large|maximum allowed size/i.test(text)) return "This file is larger than the club's plan allows.";
  if (/403|expired|not valid/i.test(text)) return "The link stopped working. Ask the committee for a new one.";
  if (/network|failed to fetch|offline/i.test(text)) return "Connection lost. Retry when you're back online.";
  return text.slice(0, 160);
}

export class GuestUploadQueue {
  private jobs = new Map<string, Job>();
  private listeners = new Set<() => void>();
  private active = 0;
  private snapshot: readonly GuestJobView[] = EMPTY_GUEST_SNAPSHOT;

  constructor(private readonly token: string) {}

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
        warnings.push(`${file.name} is over 500 MB. It will upload, but it may take a while.`);
      }
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
      this.jobs.set(key, { key, file, mimeType, status: "queued", progress: 0 });
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
      progress: j.progress,
      error: j.error,
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
        this.pump();
      });
    }
    this.emit();
  }

  /** PUT to a signed upload URL, reporting progress so big videos don't look stuck. */
  private putSigned(job: Job, signed: Signed, blob: Blob, contentType: string, weight: number, base: number) {
    return new Promise<void>((resolve, reject) => {
      const url = `${supabaseUrl}/storage/v1/object/upload/sign/${job.ticket!.bucket}/${signed.path}?token=${encodeURIComponent(signed.token)}`;
      const request = new XMLHttpRequest();
      request.open("PUT", url);
      request.setRequestHeader("content-type", contentType);
      request.setRequestHeader("x-upsert", "true");
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        this.patch(job, { progress: base + (event.loaded / event.total) * weight });
      };
      request.onload = () =>
        request.status >= 200 && request.status < 300
          ? resolve()
          : reject(new Error(`${request.status} ${request.responseText.slice(0, 120)}`));
      request.onerror = () => reject(new Error("network"));
      request.send(blob);
    });
  }

  private async process(job: Job) {
    try {
      this.patch(job, { status: "preparing", error: undefined });
      const prepared =
        job.prepared ??
        (job.mimeType.startsWith("video/") ? await prepareVideo(job.file) : await preparePhoto(job.file, job.mimeType));
      this.patch(job, {
        prepared,
        previewUrl: job.previewUrl ?? (prepared.thumb ? URL.createObjectURL(prepared.thumb) : undefined),
      });

      let ticket = job.ticket;
      if (!ticket) {
        if (job.hash === undefined) job.hash = await contentHash(job.file);
        const res = await fetch(`/api/guest/${encodeURIComponent(this.token)}/ticket`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: job.file.name,
            mimeType: job.mimeType,
            byteSize: job.file.size,
            contentHash: job.hash,
          }),
        });
        const body: Ticket & { error?: string } = await res.json();
        if (!res.ok || body.error) throw new Error(body.error ?? "Could not start the upload");
        // Already in the album: from the guest's side that is simply done.
        if (body.duplicate) return this.patch(job, { status: "done", progress: 1 });
        ticket = body;
        this.patch(job, { ticket });
      }

      if (!job.originalDone) {
        this.patch(job, { status: "uploading" });
        await this.putSigned(job, ticket.signed[ticket.storagePath], job.file, ticket.mimeType, 0.85, 0);
        this.patch(job, { originalDone: true, progress: 0.85 });
      }

      this.patch(job, { status: "finishing" });
      const derivatives: [string, Blob | null][] = [
        [ticket.derivatives.thumb, prepared.thumb],
        [ticket.derivatives.display, prepared.display],
        [ticket.derivatives.poster, prepared.poster],
      ];
      for (const [path, blob] of derivatives) {
        if (!blob) continue;
        await this.putSigned(job, ticket.signed[path], blob, blob.type || "image/webp", 0.05, job.progress);
      }

      const res = await fetch(`/api/guest/${encodeURIComponent(this.token)}/finalize/${ticket.mediaId}`, {
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
      this.patch(job, { status: "done", progress: 1 });
    } catch (error) {
      this.patch(job, { status: "failed", error: friendlyError(error) });
    }
  }
}

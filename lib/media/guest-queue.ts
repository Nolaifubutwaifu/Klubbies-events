import { contentHash } from "@/lib/media/content-hash";
import { UPLOAD_MAX_BYTES, resolveMimeType, tooBigWarning } from "@/lib/media/constants";
import { prepareVideo, preparePhoto, type Prepared } from "@/lib/media/prepare";
import { watchUploadStall } from "@/lib/media/signed-put";
import { httpStatus, isUploadRetryable, postJson, withBackoff } from "@/lib/retry";
import { supabaseUrl } from "@/lib/supabase/config";

// The guest version of the upload queue. Same shape as the member one, minus
// everything that needs a session: no TUS (which signs each chunk with a JWT),
// no resume across tabs. The server hands out one signed URL per object and
// the browser PUTs straight to storage. Like the member queue it runs two
// lanes: a few files prepared ahead while up to six upload.

export type GuestJobStatus = "queued" | "preparing" | "uploading" | "retrying" | "finishing" | "done" | "failed";

export type GuestJobView = Readonly<{
  key: string;
  name: string;
  size: number;
  status: GuestJobStatus;
  progress: number;
  error?: string;
  previewUrl?: string;
  retryAttempt?: number;
  retryOf?: number;
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
  /** Absent on a retry after the original landed: the URLs are fetched again. */
  signed?: Record<string, Signed>;
};

type Job = {
  key: string;
  file: File;
  mimeType: string;
  status: GuestJobStatus;
  progress: number;
  error?: string;
  previewUrl?: string;
  retryAttempt?: number;
  retryOf?: number;
  prepared?: Prepared;
  hash?: string | null;
  ticket?: Ticket;
  originalDone?: boolean;
};

/** Files uploading at once. */
const UPLOADS_AT_ONCE = 6;
/** Of those, videos: each is one PUT of up to hundreds of MB. */
const VIDEOS_AT_ONCE = 2;
/** Files being prepared at once: decoding and resizing is the browser's heavy work. */
const PREPARING_AT_ONCE = 2;
/** Prepared files waiting for an upload slot, at most. */
const PREPARED_AHEAD = 6;

export const EMPTY_GUEST_SNAPSHOT: readonly GuestJobView[] = [];

function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const status = httpStatus(error);
  if (/413|too large|maximum allowed size/i.test(text)) return "This file is larger than the event's plan allows.";
  // The organiser's link itself is gone. A 403 from a signed upload URL is
  // just that try's token, and a new ticket replaces it.
  if (/this link (has expired|isn't valid)|isn't valid any more|link stopped working/i.test(text)) {
    return "The link stopped working. Ask the organiser for a new one.";
  }
  if (status === 403 || /\b403\b/.test(text)) return "This try expired. Tap Retry now.";
  if (/network|failed to fetch|offline/i.test(text)) return "Connection lost. Retry when you're back online.";
  return text.slice(0, 160);
}

export class GuestUploadQueue {
  private jobs = new Map<string, Job>();
  private listeners = new Set<() => void>();
  private uploading = 0;
  private uploadingVideos = 0;
  private preparing = 0;
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
      if (file.size > UPLOAD_MAX_BYTES) {
        warnings.push(tooBigWarning(file.name));
        continue;
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
    // A ticket from a stalled upload may have expired. A fresh one carries on
    // in the same row (matched by content), so nothing is uploaded twice.
    // Drop derivative URLs when the original is already in: they are
    // short-lived, and a retry after a long video may find them expired.
    const ticket = job.originalDone && job.ticket ? { ...job.ticket, signed: undefined } : undefined;
    this.patch(job, { status: "queued", error: undefined, ticket });
    this.pump();
  }

  retryFailed() {
    for (const job of this.jobs.values()) if (job.status === "failed") this.retry(job.key);
  }

  /** Gives up on every failed file: they leave the list. */
  clearFailed() {
    for (const [key, job] of this.jobs) {
      if (job.status !== "failed") continue;
      if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
      this.jobs.delete(key);
    }
    this.emit();
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
      retryAttempt: j.retryAttempt,
      retryOf: j.retryOf,
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

  private onRetry(job: Job) {
    return (nextAttempt: number, attempts: number) => {
      this.patch(job, { status: "retrying", retryAttempt: nextAttempt, retryOf: attempts });
    };
  }

  private isVideo(job: Job) {
    return job.mimeType.startsWith("video/");
  }

  /** Prepared and fingerprinted, waiting for an upload slot. */
  private isReady(job: Job) {
    return job.status === "queued" && job.prepared !== undefined && job.hash !== undefined;
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
        this.pump();
      });
    }

    // Prepare lane: keep the next few ready; videos held back by their limit don't count.
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
      let stalled = false;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        stall.stop();
        if (error) reject(error);
        else resolve();
      };
      const stall = watchUploadStall(() => {
        stalled = true;
        request.abort();
      });
      request.open("PUT", url);
      request.setRequestHeader("content-type", contentType);
      request.setRequestHeader("x-upsert", "true");
      request.upload.onprogress = (ev) => {
        stall.bump();
        if (!ev.lengthComputable) return;
        this.patch(job, { progress: base + (ev.loaded / ev.total) * weight });
      };
      request.onload = () =>
        request.status >= 200 && request.status < 300
          ? finish()
          : finish(Object.assign(new Error(`${request.status} ${request.responseText.slice(0, 120)}`), { status: request.status }));
      request.onerror = () => finish(Object.assign(new Error("network"), { status: 0 }));
      request.onabort = () => finish(Object.assign(new Error(stalled ? "network" : "aborted"), { status: 0 }));
      request.send(blob);
    });
  }

  /** Thumbnail, preview and fingerprint, ahead of the upload. */
  private async prepare(job: Job) {
    try {
      this.patch(job, { status: "preparing", error: undefined });
      const prepared =
        job.prepared ??
        (this.isVideo(job) ? await prepareVideo(job.file) : await preparePhoto(job.file, job.mimeType));
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

  /** A fresh ticket, including signed URLs. "duplicate" means the album already has the file. */
  private async requestTicket(job: Job): Promise<Ticket | "duplicate"> {
    const res = await postJson(
      `/api/guest/${encodeURIComponent(this.token)}/ticket`,
      {
        filename: job.file.name,
        mimeType: job.mimeType,
        byteSize: job.file.size,
        contentHash: job.hash,
      },
      this.onRetry(job),
    );
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
        // Already in the album: from the guest's side that is simply done.
        if (issued === "duplicate") return this.patch(job, { status: "done", progress: 1 });
        ticket = issued;
        this.patch(job, { ticket });
      }

      if (!job.originalDone) {
        const original = ticket.signed?.[ticket.storagePath];
        if (!original) throw new Error("Could not start the upload");
        const mimeType = ticket.mimeType;
        await withBackoff(
          () => this.putSigned(job, original, job.file, mimeType, 0.85, 0),
          isUploadRetryable,
          { onRetry: this.onRetry(job) },
        );
        this.patch(job, { originalDone: true, progress: 0.85 });
      }

      if (!ticket.signed) {
        const refreshed = await this.requestTicket(job);
        if (refreshed === "duplicate") return this.patch(job, { status: "done", progress: 1 });
        ticket = refreshed;
        this.patch(job, { ticket });
      }

      this.patch(job, { status: "finishing" });
      const derivatives: [string, Blob | null][] = [
        [ticket.derivatives.thumb, prepared.thumb],
        [ticket.derivatives.display, prepared.display],
        [ticket.derivatives.poster, prepared.poster],
      ];
      for (const [path, blob] of derivatives) {
        if (!blob) continue;
        const signed = ticket.signed?.[path];
        if (!signed) throw new Error("Could not start the upload");
        await withBackoff(
          () => this.putSigned(job, signed, blob, blob.type || "image/webp", 0.05, job.progress),
          isUploadRetryable,
          { onRetry: this.onRetry(job) },
        );
      }

      const res = await postJson(
        `/api/guest/${encodeURIComponent(this.token)}/finalize/${ticket.mediaId}`,
        {
          width: prepared.width,
          height: prepared.height,
          durationSeconds: prepared.durationSeconds,
          capturedAt: prepared.capturedAt,
        },
        this.onRetry(job),
      );
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

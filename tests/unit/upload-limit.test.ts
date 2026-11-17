import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTENT_HASH_FULL_BYTES, contentHashReadsWholeFile } from "@/lib/media/content-hash";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_MB,
  TUS_CHUNK_BYTES,
  UPLOAD_MAX_MB,
  VIDEO_MAX_BYTES,
  maxBytesForKind,
  oversizeMessage,
  tooBigWarning,
  tusChunkPlan,
} from "@/lib/media/constants";

const MB = 1024 * 1024;

describe("upload size limits", () => {
  it("keeps photos at 50 MB and allows a video past the old 50 MB ceiling up to 200 MB", () => {
    expect(PHOTO_MAX_MB).toBe(50);
    expect(maxBytesForKind("photo")).toBe(50 * MB);
    expect(maxBytesForKind("video")).toBe(VIDEO_MAX_BYTES);
    expect(VIDEO_MAX_BYTES).toBe(UPLOAD_MAX_MB * MB);
    expect(UPLOAD_MAX_MB).toBe(200);
    expect(VIDEO_MAX_BYTES).toBeGreaterThan(PHOTO_MAX_BYTES);
    expect(50 * MB + 1).toBeLessThanOrEqual(VIDEO_MAX_BYTES);
    expect(VIDEO_MAX_BYTES + 1).toBeGreaterThan(maxBytesForKind("video"));
    expect(PHOTO_MAX_BYTES + 1).toBeGreaterThan(maxBytesForKind("photo"));
  });

  it("says which kind is too big, and names the file", () => {
    expect(tooBigWarning("shot.jpg", "photo")).toBe(
      "shot.jpg is over 50 MB, so it wasn't added. Photos can be up to 50 MB. Choose a smaller photo, or reduce it in Photos and add it again.",
    );
    expect(tooBigWarning("clip.mov", "video")).toBe(
      "clip.mov is over 200 MB, so it wasn't added. Videos can be up to 200 MB. Trim it or export it smaller (on iPhone: Edit, then trim), then add it again.",
    );
    expect(oversizeMessage("clip.mov", "video")).toBe(tooBigWarning("clip.mov", "video"));
  });

  it("keeps videos at 200 MB and photos at 50 MB when NEXT_PUBLIC_UPLOAD_MAX_MB is 500", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_UPLOAD_MAX_MB", "500");
    const loaded = await import("@/lib/media/constants");
    expect(loaded.UPLOAD_MAX_MB).toBe(200);
    expect(loaded.PHOTO_MAX_MB).toBe(50);
    expect(loaded.VIDEO_MAX_BYTES).toBe(200 * MB);
    expect(loaded.PHOTO_MAX_BYTES).toBe(50 * MB);
    expect(loaded.oversizeMessage("clip.mov", "video")).toContain("200 MB");
    expect(loaded.oversizeMessage("shot.jpg", "photo")).toContain("50 MB");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("splits a 200 MB video into 6 MB TUS chunks, with a short last chunk", () => {
    const fileBytes = 200 * MB;
    const plan = tusChunkPlan(fileBytes);
    expect(TUS_CHUNK_BYTES).toBe(6 * MB);
    expect(plan.chunks).toBeGreaterThan(1);
    expect(plan.fullChunks).toBe(plan.chunks - 1);
    expect(plan.lastChunkBytes).toBeGreaterThan(0);
    expect(plan.lastChunkBytes).toBeLessThanOrEqual(TUS_CHUNK_BYTES);
    expect(plan.fullChunks * TUS_CHUNK_BYTES + plan.lastChunkBytes).toBe(fileBytes);
    // 200 MiB is 33 full 6 MiB chunks plus a 2 MiB remainder.
    expect(plan).toEqual({ chunks: 34, fullChunks: 33, lastChunkBytes: 2 * MB });
  });

  it("does not read a 200 MB video into memory to fingerprint it", () => {
    expect(contentHashReadsWholeFile(200 * MB)).toBe(false);
    expect(contentHashReadsWholeFile(CONTENT_HASH_FULL_BYTES)).toBe(true);
    expect(contentHashReadsWholeFile(PHOTO_MAX_BYTES)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
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
    expect(VIDEO_MAX_BYTES).toBeGreaterThan(PHOTO_MAX_BYTES);
    // Unset NEXT_PUBLIC_UPLOAD_MAX_MB uses 200. A set value is capped at 500.
    const configured = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB);
    const expected = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 500) : 200;
    expect(UPLOAD_MAX_MB).toBe(expected);
    expect(50 * MB + 1).toBeLessThanOrEqual(VIDEO_MAX_BYTES);
    expect(VIDEO_MAX_BYTES + 1).toBeGreaterThan(maxBytesForKind("video"));
    expect(PHOTO_MAX_BYTES + 1).toBeGreaterThan(maxBytesForKind("photo"));
  });

  it("says which kind is too big", () => {
    expect(oversizeMessage("video")).toContain(`${UPLOAD_MAX_MB} MB`);
    expect(oversizeMessage("photo")).toContain("50 MB");
    expect(tooBigWarning("clip.mov", "video")).toContain("Videos can be up to");
    expect(tooBigWarning("shot.jpg", "photo")).toContain("Photos can be up to");
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

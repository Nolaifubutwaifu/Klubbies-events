import { describe, expect, it } from "vitest";
import {
  GRAB_FRAME_TIMEOUT_MS,
  VIDEO_PREVIEW_CRON_BUDGET_MS,
  VIDEO_PREVIEW_KICK_BUDGET_MS,
  VIDEO_PREVIEW_PER_RUN,
} from "@/lib/media/video-previews";

describe("video preview throughput", () => {
  it("does more than the old six-per-hour cap and stays inside the cron", () => {
    expect(VIDEO_PREVIEW_PER_RUN).toBeGreaterThan(6);
    expect(VIDEO_PREVIEW_CRON_BUDGET_MS).toBeGreaterThan(60_000);
    expect(VIDEO_PREVIEW_CRON_BUDGET_MS).toBeLessThanOrEqual(120_000);
    // The hourly route keeps 20s in hand of its 300s limit (deadline is 280s).
    expect(VIDEO_PREVIEW_CRON_BUDGET_MS).toBeLessThan(280_000);
  });

  it("keeps one frame seek inside the kick, so a 200 MB video cannot outlive it", () => {
    expect(GRAB_FRAME_TIMEOUT_MS).toBeLessThan(VIDEO_PREVIEW_KICK_BUDGET_MS);
    expect(VIDEO_PREVIEW_KICK_BUDGET_MS).toBeLessThanOrEqual(VIDEO_PREVIEW_CRON_BUDGET_MS);
  });
});

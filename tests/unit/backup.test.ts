import { describe, expect, it } from "vitest";
import { attachmentHeader, isBackedUpPath, r2ConfigFrom } from "@/lib/backup/r2-core";
import { isMonthlyCheckHour } from "@/lib/backup/r2";

const EVENT = "11111111-2222-3333-4444-555555555555";

describe("R2 backup", () => {
  it("copies event originals, previews and logos, never face data", () => {
    expect(isBackedUpPath(`events/${EVENT}/albums/a/m/original.jpg`)).toBe(true);
    expect(isBackedUpPath(`events/${EVENT}/albums/a/m/thumb.webp`)).toBe(true);
    expect(isBackedUpPath(`events/${EVENT}/logo/logo-17.png`)).toBe(true);
    expect(isBackedUpPath(`faces/${EVENT}/selfie.jpg`)).toBe(false);
    expect(isBackedUpPath(`avatars/${EVENT}/me.jpg`)).toBe(false);
  });

  it("is off unless all four settings are there", () => {
    expect(r2ConfigFrom({})).toBeNull();
    expect(r2ConfigFrom({ R2_BUCKET: "b", R2_ACCOUNT_ID: "a" })).toBeNull();
    expect(
      r2ConfigFrom({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "b" }),
    ).toMatchObject({ accountId: "a", bucket: "b" });
  });

  it("keeps a non-English filename on download", () => {
    expect(attachmentHeader("Ball – photo.jpg")).toBe(
      `attachment; filename="Ball _ photo.jpg"; filename*=UTF-8''Ball%20%E2%80%93%20photo.jpg`,
    );
  });

  it("runs the monthly check at 3am Brisbane on the 1st", () => {
    expect(isMonthlyCheckHour(new Date("2026-09-30T17:00:00Z"))).toBe(true); // 1 Oct, 3am Brisbane
    expect(isMonthlyCheckHour(new Date("2026-10-01T17:00:00Z"))).toBe(false);
    expect(isMonthlyCheckHour(new Date("2026-09-30T18:00:00Z"))).toBe(false);
  });
});

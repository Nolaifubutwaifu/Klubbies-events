import { describe, expect, it } from "vitest";
import { personName } from "@/lib/auth/display-name";
import { faceSquare } from "@/lib/faces/crop";
import { exifToIso } from "@/lib/media/exif-time";
import { formatTime } from "@/lib/format";
import { logoMarkPath } from "@/lib/storage";

describe("EXIF capture time", () => {
  it("reads a zone-less time as Brisbane wall-clock time", () => {
    // 6:01 pm on the camera is 08:01 UTC, and shows as 6:01 pm again.
    expect(exifToIso("2026:09:19 18:01:00")).toBe("2026-09-19T08:01:00.000Z");
    expect(formatTime(exifToIso("2026:09:19 18:01:00"))).toBe("6:01 pm");
  });

  it("uses OffsetTimeOriginal when the camera recorded one", () => {
    expect(exifToIso("2026:12:01 21:30:00", "+11:00")).toBe("2026-12-01T10:30:00.000Z");
    expect(exifToIso("2026:12:01 21:30:00", "-0500")).toBe("2026-12-02T02:30:00.000Z");
  });

  it("ignores junk and unset camera clocks", () => {
    expect(exifToIso(undefined)).toBeNull();
    expect(exifToIso("0000:00:00 00:00:00")).toBeNull();
    expect(exifToIso("yesterday")).toBeNull();
    expect(exifToIso("2026:09:19 18:01:00", "nonsense")).toBe("2026-09-19T08:01:00.000Z");
  });
});

describe("formatTime", () => {
  it("names its zone, so a UTC server doesn't shift it", () => {
    expect(formatTime("2026-09-19T08:01:00Z")).toBe("6:01 pm");
    expect(formatTime(null)).toBe("");
  });
});

describe("face crop square", () => {
  it("is square in pixels on a landscape photo", () => {
    // A face 300px square in a 3000×2000 photo: 0.1 of the width, 0.15 of the height.
    const crop = faceSquare({ Left: 0.45, Top: 0.4, Width: 0.1, Height: 0.15 }, 3000, 2000);
    expect(crop.size).toBe(480); // 300px padded by 60%
    expect(crop.left).toBe(1260);
    expect(crop.top).toBe(710);
  });

  it("stays inside the image at the edges", () => {
    const crop = faceSquare({ Left: 0, Top: 0.9, Width: 0.1, Height: 0.1 }, 1000, 1000);
    expect(crop.left).toBe(0);
    expect(crop.top + crop.size).toBeLessThanOrEqual(1000);
  });

  it("never asks for more than the short side", () => {
    const crop = faceSquare({ Left: 0.1, Top: 0.1, Width: 0.8, Height: 0.8 }, 2000, 1000);
    expect(crop.size).toBe(1000);
    expect(crop.top).toBe(0);
  });
});

describe("logo mark path", () => {
  it("sits beside the logo, versioned the same way", () => {
    expect(logoMarkPath("clubs/abc/logo/logo-1727.png")).toBe("clubs/abc/logo/mark-1727.webp");
    expect(logoMarkPath("clubs/abc/logo/logo.svg")).toBe("clubs/abc/logo/mark.webp");
  });
});

describe("person name", () => {
  it("prefers the profile name everywhere", () => {
    expect(personName({ displayName: "max", claimedName: "Maxi", rosterName: "Maximilian" })).toBe("max");
  });

  it("falls back through claimed, roster and email", () => {
    expect(personName({ displayName: " ", claimedName: "Maxi", rosterName: "Maximilian" })).toBe("Maxi");
    expect(personName({ rosterName: "Maximilian" })).toBe("Maximilian");
    expect(personName({ email: "m@uq.edu.au" })).toBe("m@uq.edu.au");
    expect(personName({})).toBe("");
  });
});

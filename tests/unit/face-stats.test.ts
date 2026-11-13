import { describe, expect, it } from "vitest";
import { FACE_FLOORS } from "@/lib/faces/constants";
import { faceStats } from "@/lib/faces/stats";

const face = (width: number, sharpness = 80, brightness = 80) => ({
  Face: { BoundingBox: { Width: width } },
  FaceDetail: { Quality: { Sharpness: sharpness, Brightness: brightness } },
});

describe("faceStats", () => {
  it("counts what was kept and why the rest were let go", () => {
    const stats = faceStats(
      [face(0.2)],
      [face(0.03), face(0.04, 5), face(0.3, 80, 10)],
      [{ Reasons: ["SMALL_BOUNDING_BOX", "LOW_SHARPNESS"] }, { Reasons: ["SMALL_BOUNDING_BOX"] }],
      FACE_FLOORS,
    );
    expect(stats).toEqual({
      v: 1,
      kept: 1,
      small: 2,
      soft: 1,
      dark: 1,
      unindexed: 2,
      reasons: { SMALL_BOUNDING_BOX: 2, LOW_SHARPNESS: 1 },
    });
  });

  it("records a photo with no faces at all", () => {
    expect(faceStats([], [], undefined, FACE_FLOORS)).toEqual({ v: 1, kept: 0, small: 0, soft: 0, dark: 0, unindexed: 0, reasons: {} });
  });
});

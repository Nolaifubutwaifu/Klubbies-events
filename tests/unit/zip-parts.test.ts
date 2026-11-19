import { describe, expect, it } from "vitest";
import { ZIP_LOOKAHEAD_BYTES, ZIP_PART_BYTES, ZIP_PART_SIZE, planZipParts, zipLookahead, zipPartFileCounts, zipPartSummaries } from "@/lib/media/zip-parts";

const mb = (n: number) => n * 1024 * 1024;

describe("zip parts", () => {
  it("keeps a small album in one part", () => {
    const items = Array.from({ length: 10 }, () => ({ byteSize: mb(2) }));
    expect(zipPartFileCounts(items)).toEqual([10]);
  });

  it("still closes a part at 150 files", () => {
    const items = Array.from({ length: ZIP_PART_SIZE + 1 }, () => ({ byteSize: 1000 }));
    expect(zipPartFileCounts(items)).toEqual([ZIP_PART_SIZE, 1]);
  });

  it("closes a part around 500 MB even with fewer files", () => {
    const items = [
      { id: "a", byteSize: mb(200) },
      { id: "b", byteSize: mb(200) },
      { id: "c", byteSize: mb(150) },
      { id: "d", byteSize: mb(100) },
    ];
    const parts = planZipParts(items);
    expect(parts.map((part) => part.map((item) => item.id))).toEqual([["a", "b"], ["c", "d"]]);
    expect(zipPartSummaries(items).map((part) => part.bytes)).toEqual([mb(400), mb(250)]);
    for (const part of parts) {
      const bytes = part.reduce((sum, item) => sum + (item.byteSize ?? 0), 0);
      expect(bytes).toBeLessThanOrEqual(ZIP_PART_BYTES);
    }
  });

  it("does not split one file that is already over the cap", () => {
    const parts = planZipParts([{ id: "big", byteSize: ZIP_PART_BYTES + mb(50) }, { id: "next", byteSize: mb(1) }]);
    expect(parts.map((part) => part.map((item) => item.id))).toEqual([["big"], ["next"]]);
  });

  it("treats an unknown size as zero and still counts the file", () => {
    const items = Array.from({ length: ZIP_PART_SIZE + 1 }, () => ({ byteSize: null }));
    expect(zipPartFileCounts(items)).toEqual([ZIP_PART_SIZE, 1]);
  });
});

describe("zip lookahead", () => {
  const MB = 1024 * 1024;
  it("requests up to six small files ahead", () => {
    expect(zipLookahead(Array(20).fill(1 * MB), 0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("stops at the byte budget, so big originals sit unread for less", () => {
    expect(zipLookahead([15 * MB, 15 * MB, 15 * MB], 0)).toEqual([0, 1]);
    expect(zipLookahead([1, 30 * MB, 1], 0)).toEqual([0]);
  });
  it("treats an unknown size as the whole budget: it can go ahead, nothing after it", () => {
    expect(zipLookahead([1, null, 1], 0)).toEqual([0, 1]);
    expect(zipLookahead([1, ZIP_LOOKAHEAD_BYTES], 0)).toEqual([0, 1]);
  });
  it("never runs past the end", () => {
    expect(zipLookahead([1, 1, 1], 2)).toEqual([2]);
  });
});

import { describe, expect, it } from "vitest";
import { findAnniversary } from "@/lib/media/anniversary";

const album = (date: string, counts = { photoCount: 10, videoCount: 0 }) => ({ date, ...counts });
const TODAY = new Date(2026, 8, 18); // 18 Sept 2026, local

describe("findAnniversary", () => {
  it("finds an album from exactly a year ago", () => {
    const a = album("2025-09-18");
    expect(findAnniversary([a], TODAY)).toEqual({ album: a, years: 1 });
  });

  it("allows three days of slack either side", () => {
    expect(findAnniversary([album("2025-09-21")], TODAY)?.years).toBe(1);
    expect(findAnniversary([album("2025-09-15")], TODAY)?.years).toBe(1);
  });

  it("ignores albums more than three days off the anniversary", () => {
    expect(findAnniversary([album("2025-09-22")], TODAY)).toBeNull();
    expect(findAnniversary([album("2025-10-18")], TODAY)).toBeNull();
  });

  it("ignores albums from the current year", () => {
    expect(findAnniversary([album("2026-09-18")], TODAY)).toBeNull();
  });

  it("counts multiple years back", () => {
    expect(findAnniversary([album("2023-09-18")], TODAY)).toEqual({ album: album("2023-09-18"), years: 3 });
  });

  it("skips empty albums", () => {
    expect(findAnniversary([album("2025-09-18", { photoCount: 0, videoCount: 0 })], TODAY)).toBeNull();
  });

  it("prefers the closest date, then the most recent year", () => {
    const near = album("2025-09-18");
    const far = album("2024-09-20");
    expect(findAnniversary([far, near], TODAY)?.album).toBe(near);

    const older = album("2023-09-18");
    const newer = album("2025-09-18");
    expect(findAnniversary([older, newer], TODAY)?.album).toBe(newer);
  });

  it("handles a full timestamp as well as a bare date", () => {
    expect(findAnniversary([album("2025-09-18T09:30:00.000Z")], TODAY)?.years).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { brisbaneInputToIso, isoToBrisbaneInput } from "@/lib/format";

describe("brisbane datetime-local", () => {
  it("reads a bare datetime-local value as Brisbane time", () => {
    expect(brisbaneInputToIso("2026-10-09T09:00")).toBe("2026-10-08T23:00:00.000Z");
  });
  it("keeps an explicit offset", () => {
    expect(brisbaneInputToIso("2026-10-09T09:00:00Z")).toBe("2026-10-09T09:00:00.000Z");
  });
  it("rejects nonsense", () => {
    expect(brisbaneInputToIso("tomorrow")).toBeNull();
  });
  it("round trips", () => {
    expect(isoToBrisbaneInput(brisbaneInputToIso("2026-12-31T23:30"))).toBe("2026-12-31T23:30");
  });
});

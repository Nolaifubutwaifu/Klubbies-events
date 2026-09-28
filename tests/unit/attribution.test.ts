import { describe, expect, it } from "vitest";
import { isHeardFrom, SOURCE_TAG } from "@/lib/attribution";

describe("tracked link tags", () => {
  it("accept plain tags and refuse anything else", () => {
    expect(SOURCE_TAG.test("flyer-uq-union")).toBe(true);
    expect(SOURCE_TAG.test("credit")).toBe(true);
    expect(SOURCE_TAG.test("<script>")).toBe(false);
    expect(SOURCE_TAG.test("-leading")).toBe(false);
    expect(SOURCE_TAG.test("x".repeat(65))).toBe(false);
  });

  it("only take the listed answers to how you heard", () => {
    expect(isHeardFrom("photographer")).toBe(true);
    expect(isHeardFrom("tv")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { generateHandleBase } from "@/lib/roster/handle";

describe("generateHandleBase", () => {
  it("lowercases and joins words with underscores", () => {
    expect(generateHandleBase("UQ Volleyball")).toBe("uq_volleyball");
  });

  it("strips accents and transliterates", () => {
    expect(generateHandleBase("Rowing Club Lüneburg")).toBe("rowing_club_luneburg");
    expect(generateHandleBase("Straße Æsir Øresund")).toBe("strasse_aesir_oresund");
  });

  it("collapses punctuation into single underscores and trims", () => {
    expect(generateHandleBase("  --QUT's   Rock & Roll!! Society--  ")).toBe("qut_s_rock_roll_society");
  });

  it("truncates to 40 characters at a word boundary", () => {
    const handle = generateHandleBase("The University of Queensland Underwater Hockey and Snorkelling Club");
    expect(handle.length).toBeLessThanOrEqual(40);
    expect(handle).toBe("the_university_of_queensland_underwater");
  });

  it("hard-cuts a single very long word", () => {
    expect(generateHandleBase("a".repeat(60))).toBe("a".repeat(40));
  });

  it("falls back when nothing usable remains", () => {
    expect(generateHandleBase("!!!")).toBe("club");
    expect(generateHandleBase("東京")).toBe("club");
  });
});

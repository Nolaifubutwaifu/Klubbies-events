import { describe, expect, it } from "vitest";
import { namesLooselyMatch } from "@/lib/auth/names";

describe("namesLooselyMatch", () => {
  it.each([
    ["Mara Lindqvist", "mara lindqvist"],
    ["Mara Lindqvist", "Mara"],
    ["Tomás Ferreira", "Tomas Ferreira"],
    ["Jonas Weber", "J. Weber"],
    ["Weber Jonas", "Jonas Weber"],
    ["Priya Raman", "Priya Ramen"],
    ["Mary-Jane O'Neil", "Maryjane ONeil"],
    ["Alexander Smith", "Alex Smith"],
  ])("%s ≈ %s", (roster, claimed) => {
    expect(namesLooselyMatch(roster, claimed)).toBe(true);
  });

  it.each([
    ["Mara Lindqvist", "Jonas Weber"],
    ["Priya Raman", "Someone Else"],
    ["Lena Brandt", ""],
  ])("%s ≠ %s", (roster, claimed) => {
    expect(namesLooselyMatch(roster, claimed)).toBe(false);
  });
});

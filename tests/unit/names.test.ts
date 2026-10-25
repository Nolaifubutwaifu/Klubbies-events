import { describe, expect, it } from "vitest";
import { holdsForNameMismatch, namesLooselyMatch } from "@/lib/auth/names";

describe("namesLooselyMatch", () => {
  it.each([
    ["Mara Lindqvist", "mara lindqvist"],
    ["Tomás Ferreira", "Tomas Ferreira"],
    ["Jonas Weber", "J. Weber"],
    ["Weber Jonas", "Jonas Weber"],
    ["Priya Raman", "Priya Ramen"],
    ["Mary-Jane O'Neil", "Maryjane ONeil"],
    ["Alexander Smith", "Alex Smith"],
    ["Samantha Lee", "Sam Lee"],
    ["Alice Smith", "A Smith"],
    ["Alice Smith", "alice.smith"],
    ["张伟", "张伟"],
  ])("%s ≈ %s", (roster, claimed) => {
    expect(namesLooselyMatch(roster, claimed)).toBe(true);
  });

  it.each([
    ["Mara Lindqvist", "Jonas Weber"],
    ["Priya Raman", "Someone Else"],
    ["Lena Brandt", ""],
    ["Serena", "higgi"],
    ["Maximilian Umschaden", "Max Smith"],
    ["Serena Cheung", "Se"],
    ["Mara Lindqvist", "Mara"],
    ["Maximilian Umschaden", "Max"],
    ["Serena", "Serena Cheung"],
    ["Alice Smith", "Smith"],
    ["Alice Smith", "Ali"],
    ["Alice Smith", "Aaron Smith"],
    ["张伟", "王伟"],
  ])("%s ≠ %s", (roster, claimed) => {
    expect(namesLooselyMatch(roster, claimed)).toBe(false);
  });
});

describe("holdsForNameMismatch", () => {
  it("does not hold a membership just created by a link join", () => {
    expect(holdsForNameMismatch(true, "ada", "Ada Lovelace")).toBe(false);
  });

  it("still holds a guest-list name that does not match", () => {
    expect(holdsForNameMismatch(false, "Serena Cheung", "Someone Else")).toBe(true);
    expect(holdsForNameMismatch(false, "Ada Lovelace", "Ada Lovelace")).toBe(false);
  });
});

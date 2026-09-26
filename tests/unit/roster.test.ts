import { describe, expect, it } from "vitest";
import { isValidEmail, normaliseEmail } from "@/lib/roster/email";
import { buildRosterPlan, problemsToCsv } from "@/lib/roster/normalise";
import {
  applySavedMapping,
  detectHeaderRow,
  guessMapping,
  parseManualEntry,
  readSpreadsheet,
  structureSheet,
  toSavedMapping,
} from "@/lib/roster/parse";

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("emails", () => {
  it("normalises", () => {
    expect(normaliseEmail("  Mara@Uni.EDU ")).toBe("mara@uni.edu");
    expect(normaliseEmail("mailto:<a@b.co>")).toBe("a@b.co");
  });

  it.each(["mara@uni.edu", "j.weber+club@students.uq.edu.au", "o'neil@example.com"])("accepts %s", (e) => {
    expect(isValidEmail(e)).toBe(true);
  });

  it.each(["", "mara", "mara@", "@uni.edu", "mara@uni", "ma..ra@uni.edu", "mara@uni..edu", "a b@uni.edu", "mara@uni.e", "x@-bad.com"])(
    "rejects %s",
    (e) => {
      expect(isValidEmail(e)).toBe(false);
    },
  );
});

describe("header detection", () => {
  it("finds headers below title rows", () => {
    const grid = [
      ["UQ Volleyball membership export"],
      ["Generated 2 Sep"],
      [""],
      ["Student ID", "Given name", "Surname", "Email address", "Year"],
      ["123", "Mara", "Lindqvist", "mara@uni.edu", "2"],
    ];
    expect(detectHeaderRow(grid)).toBe(3);
    const sheet = structureSheet(grid);
    expect(sheet.firstDataRowNumber).toBe(5);
    expect(guessMapping(sheet)).toEqual({ email: 3, fullName: null, firstName: 1, lastName: 2 });
  });

  it("handles files with no header row", () => {
    const sheet = structureSheet([
      ["Mara Lindqvist", "mara@uni.edu"],
      ["Jonas Weber", "j.weber@uni.edu"],
    ]);
    expect(sheet.headerRowIndex).toBe(-1);
    expect(sheet.columns).toEqual(["Column A", "Column B"]);
    expect(guessMapping(sheet)).toEqual({ email: 1, fullName: 0, firstName: null, lastName: null });
  });

  it("reads CSV with BOM, quotes and blank lines", () => {
    const csv = '﻿Name,Email\n"Ferreira, Tomás",T.Ferreira@uni.edu\n\nLena Brandt,lena@uni.edu\n';
    const sheet = structureSheet(readSpreadsheet(encode(csv), "members.csv"));
    expect(sheet.columns).toEqual(["Name", "Email"]);
    expect(sheet.dataRows).toEqual([
      ["Ferreira, Tomás", "T.Ferreira@uni.edu"],
      ["Lena Brandt", "lena@uni.edu"],
    ]);
  });

  it("round-trips a saved mapping by label", () => {
    const sheet = structureSheet([["Email", "Full name"], ["a@b.co", "A B"]]);
    const mapping = guessMapping(sheet);
    expect(mapping).not.toBeNull();
    const saved = toSavedMapping(sheet.columns, mapping!);
    expect(applySavedMapping(["Full name", "Phone", "EMAIL"], saved)).toEqual({ email: 2, fullName: 0, firstName: null, lastName: null });
  });
});

describe("manual entry", () => {
  it("accepts several formats", () => {
    expect(parseManualEntry("Mara Lindqvist, mara@uni.edu\nJonas Weber <j.weber@uni.edu>\npriya@uni.edu\n\n")).toEqual([
      ["Full name", "Email"],
      ["Mara Lindqvist", "mara@uni.edu"],
      ["Jonas Weber", "j.weber@uni.edu"],
      ["", "priya@uni.edu"],
    ]);
  });
});

describe("buildRosterPlan", () => {
  const mapping = { email: 1, fullName: 0, firstName: null, lastName: null };

  it("dedupes, validates and compares with the existing roster", () => {
    const rows = [
      ["Mara Lindqvist", "MARA@uni.edu"],
      ["Mara Again", "mara@uni.edu"],
      ["Jonas Weber", "j.weber@uni.edu"],
      ["Broken", "not-an-email"],
      ["", "noname@uni.edu"],
      ["Lena Brandt", "lena@uni.edu"],
      ["Yusuf Demir", ""],
      ["", ""],
    ];
    const existing = [
      { email: "j.weber@uni.edu", status: "active" },
      { email: "lena@uni.edu", status: "grace" },
    ];
    const plan = buildRosterPlan(rows, mapping, existing, 2);
    expect(plan.rowCount).toBe(7);
    expect(plan.toAdd).toEqual([{ name: "Mara Lindqvist", email: "mara@uni.edu" }]);
    expect(plan.alreadyPresent.map((r) => r.email)).toEqual(["j.weber@uni.edu"]);
    expect(plan.toRestore.map((r) => r.email)).toEqual(["lena@uni.edu"]);
    expect(plan.problems.map((p) => [p.row, p.reason])).toEqual([
      [3, "duplicate in file"],
      [5, "invalid email"],
      [6, "missing name"],
      [8, "missing email"],
    ]);
    expect(problemsToCsv(plan.problems).split("\n")[0]).toBe("Row,Name,Email,Problem");
  });

  it("combines first and last name columns", () => {
    const plan = buildRosterPlan([["Mara", " Lindqvist ", "mara@uni.edu"]], { email: 2, fullName: null, firstName: 0, lastName: 1 }, [], 2);
    expect(plan.toAdd).toEqual([{ name: "Mara Lindqvist", email: "mara@uni.edu" }]);
  });
});

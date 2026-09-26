import * as XLSX from "xlsx";
import { EMAIL_IN_TEXT } from "./email";

export type Grid = string[][];

export type ColumnMapping = {
  email: number;
  fullName: number | null;
  firstName: number | null;
  lastName: number | null;
};

/** Header labels remembered per club so the next import maps itself. */
export type SavedMapping = {
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type ParsedSheet = {
  headerRowIndex: number; // -1 when no header row was found
  columns: string[];
  dataRows: Grid;
  firstDataRowNumber: number; // 1-based spreadsheet row of dataRows[0]
};

export const MAX_ROSTER_ROWS = 20000;

const HEADER_WORDS =
  /^(full[\s_-]*name|name|names|member|member[\s_-]*name|student[\s_-]*name|display[\s_-]*name|first[\s_-]*name|given[\s_-]*name|forename|preferred[\s_-]*name|vorname|last[\s_-]*name|surname|family[\s_-]*name|nachname|e[\s_-]*mail|email[\s_-]*address|e[\s_-]*mail[\s_-]*address|mail|uni[\s_-]*email|student[\s_-]*email|student[\s_-]*id|id|phone|mobile|role|position|year|degree|status|joined|membership)$/i;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function trimGrid(rows: unknown[][]): Grid {
  return rows
    .map((row) => row.map(cellText))
    .filter((row) => row.some((cell) => cell !== ""))
    .slice(0, MAX_ROSTER_ROWS + 10);
}

/** Reads the first non-empty sheet of a .csv/.tsv/.xlsx/.xls file. */
export function readSpreadsheet(data: ArrayBuffer, filename: string): Grid {
  const lower = filename.toLowerCase();
  const isText = /\.(csv|tsv|txt)$/.test(lower);
  const workbook = isText
    ? XLSX.read(new TextDecoder("utf-8").decode(data).replace(/^﻿/, ""), {
        type: "string",
        raw: false,
        FS: lower.endsWith(".tsv") ? "\t" : undefined,
      })
    : XLSX.read(new Uint8Array(data), { type: "array", raw: false, cellDates: true });

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false });
    const grid = trimGrid(rows);
    if (grid.length > 0) return grid;
  }
  return [];
}

/**
 * Manual entry, one member per line. Accepts "Name, email", "Name <email>",
 * tab separated pairs, or a bare email.
 */
export function parseManualEntry(text: string): Grid {
  const rows: Grid = [["Full name", "Email"]];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(EMAIL_IN_TEXT);
    const email = match ? match[0] : "";
    const name = (match ? line.replace(match[0], " ") : line)
      .replace(/[<>(),;\t"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    rows.push([name, email]);
  }
  return rows;
}

function headerScore(row: string[]): number {
  if (row.some((cell) => cell.includes("@"))) return 0;
  return row.filter((cell) => HEADER_WORDS.test(cell)).length;
}

/** Scans the first 10 rows for the row that looks most like headers. */
export function detectHeaderRow(grid: Grid): number {
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(10, grid.length); i++) {
    const score = headerScore(grid[i]);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function structureSheet(grid: Grid): ParsedSheet {
  const headerRowIndex = detectHeaderRow(grid);
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const header = headerRowIndex >= 0 ? grid[headerRowIndex] : [];
  const columns = Array.from({ length: width }, (_, i) => header[i] || `Column ${columnLetter(i)}`);
  const dataRows = grid
    .slice(headerRowIndex + 1)
    .map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""));
  return { headerRowIndex, columns, dataRows, firstDataRowNumber: headerRowIndex + 2 };
}

function findColumn(columns: string[], pattern: RegExp, exclude: number[] = []): number | null {
  const index = columns.findIndex((label, i) => !exclude.includes(i) && pattern.test(label.trim()));
  return index >= 0 ? index : null;
}

export function guessMapping(sheet: ParsedSheet): ColumnMapping | null {
  const { columns, dataRows } = sheet;
  const sample = dataRows.slice(0, 200);

  let email = findColumn(columns, /e[\s_-]*mail|^mail$/i);
  if (email === null) {
    let bestCount = 0;
    columns.forEach((_, i) => {
      const count = sample.filter((row) => row[i]?.includes("@")).length;
      if (count > bestCount) {
        bestCount = count;
        email = i;
      }
    });
  }
  if (email === null) return null;

  const firstName = findColumn(columns, /first|given|forename|vorname|preferred/i, [email]);
  const lastName = findColumn(columns, /last|surname|family|nachname/i, [email]);
  let fullName = findColumn(
    columns,
    /^(full[\s_-]*name|name|names|member([\s_-]*name)?|student[\s_-]*name|display[\s_-]*name)$/i,
    [email],
  );

  if (fullName === null && (firstName === null || lastName === null)) {
    // No usable header: pick the column with the most letter-only text.
    let bestCount = 0;
    columns.forEach((_, i) => {
      if (i === email) return;
      const count = sample.filter((row) => /^[\p{L}][\p{L}\s.'’-]+$/u.test(row[i] ?? "")).length;
      if (count > bestCount) {
        bestCount = count;
        fullName = i;
      }
    });
  }

  return {
    email,
    fullName,
    firstName: fullName === null ? firstName : null,
    lastName: fullName === null ? lastName : null,
  };
}

export function toSavedMapping(columns: string[], mapping: ColumnMapping): SavedMapping {
  const label = (i: number | null) => (i === null ? null : (columns[i] ?? null));
  return {
    email: columns[mapping.email] ?? "",
    fullName: label(mapping.fullName),
    firstName: label(mapping.firstName),
    lastName: label(mapping.lastName),
  };
}

export function applySavedMapping(columns: string[], saved: SavedMapping): ColumnMapping | null {
  const find = (label: string | null) => {
    if (!label) return null;
    const i = columns.findIndex((c) => c.trim().toLowerCase() === label.trim().toLowerCase());
    return i >= 0 ? i : null;
  };
  const email = find(saved.email);
  if (email === null) return null;
  const mapping = {
    email,
    fullName: find(saved.fullName),
    firstName: find(saved.firstName),
    lastName: find(saved.lastName),
  };
  if (mapping.fullName === null && (mapping.firstName === null || mapping.lastName === null)) return null;
  return mapping;
}

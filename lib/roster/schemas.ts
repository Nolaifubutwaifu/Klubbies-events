import { z } from "zod";
import { MAX_ROSTER_CELL, MAX_ROSTER_COLUMNS, MAX_ROSTER_ROWS } from "./parse";

export const columnMappingSchema = z.object({
  email: z.number().int().min(0),
  fullName: z.number().int().min(0).nullable(),
  firstName: z.number().int().min(0).nullable(),
  lastName: z.number().int().min(0).nullable(),
});

export const savedMappingSchema = z.object({
  email: z.string(),
  fullName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

const rosterCell = z.string().max(MAX_ROSTER_CELL);

export const previewReportSchema = z.object({
  columns: z.array(rosterCell).max(MAX_ROSTER_COLUMNS),
  rows: z.array(z.array(rosterCell).max(MAX_ROSTER_COLUMNS)).max(MAX_ROSTER_ROWS),
  firstDataRowNumber: z.number().int(),
  headerRowIndex: z.number().int(),
});

export type PreviewResponse = {
  importId: string;
  filename: string;
  columns: string[];
  sample: string[][];
  mapping: z.infer<typeof columnMappingSchema> | null;
  rowCount: number;
  headerRowNumber: number | null;
  usedSavedMapping: boolean;
};

export type CommitResponse = {
  dryRun: boolean;
  rowCount: number;
  added: number;
  restored: number;
  alreadyPresent: number;
  problems: { row: number; name: string; email: string; reason: string }[];
  problemCount: number;
  /** Current members who were not in the uploaded file. */
  missing: { id: string; name: string; email: string }[];
};

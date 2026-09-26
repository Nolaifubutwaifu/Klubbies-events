import { NextResponse } from "next/server";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import type { Json } from "@/lib/db/types";
import {
  MAX_ROSTER_ROWS,
  applySavedMapping,
  guessMapping,
  parseManualEntry,
  readSpreadsheet,
  structureSheet,
} from "@/lib/roster/parse";
import { savedMappingSchema, type PreviewResponse } from "@/lib/roster/schemas";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const clubId = z.uuid().safeParse(form?.get("clubId"));
  if (!form || !clubId.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const ctx = await getClubContextById(clubId.data);
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canWrite(ctx.club.billing_status)) return NextResponse.json({ error: ACTIVATE_MESSAGE }, { status: 402 });

  const file = form.get("file");
  const text = form.get("text");
  let grid: string[][];
  let filename: string;

  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "That file is over 10 MB. Export just the name and email columns." }, { status: 413 });
      }
      if (!/\.(csv|tsv|txt|xlsx|xls|ods)$/i.test(file.name)) {
        return NextResponse.json({ error: "Upload a .csv or .xlsx file" }, { status: 415 });
      }
      grid = readSpreadsheet(await file.arrayBuffer(), file.name);
      filename = file.name.slice(0, 255);
    } else if (typeof text === "string" && text.trim()) {
      grid = parseManualEntry(text.slice(0, 500_000));
      filename = "Typed list";
    } else {
      return NextResponse.json({ error: "Choose a file or paste some members" }, { status: 400 });
    }
  } catch (error) {
    console.error("roster parse failed", error);
    return NextResponse.json({ error: "We couldn't read that file. Try saving it as CSV." }, { status: 422 });
  }

  const sheet = structureSheet(grid);
  if (sheet.dataRows.length === 0) {
    return NextResponse.json({ error: "That file doesn't have any member rows" }, { status: 422 });
  }
  if (sheet.dataRows.length > MAX_ROSTER_ROWS) {
    return NextResponse.json({ error: `Rosters are limited to ${MAX_ROSTER_ROWS.toLocaleString()} rows per import` }, { status: 413 });
  }

  const saved = savedMappingSchema.safeParse(ctx.club.roster_mapping);
  const fromSaved = saved.success ? applySavedMapping(sheet.columns, saved.data) : null;
  const mapping = fromSaved ?? guessMapping(sheet);

  const supabase = await createClient();
  const report = {
    columns: sheet.columns,
    rows: sheet.dataRows,
    firstDataRowNumber: sheet.firstDataRowNumber,
    headerRowIndex: sheet.headerRowIndex,
  };
  const { data, error } = await supabase
    .from("roster_imports")
    .insert({
      club_id: ctx.club.id,
      filename,
      status: "preview",
      row_count: sheet.dataRows.length,
      report: report as unknown as Json,
      mapping: mapping as unknown as Json,
      imported_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not start the import" }, { status: 500 });

  const body: PreviewResponse = {
    importId: data.id,
    filename,
    columns: sheet.columns,
    sample: sheet.dataRows.slice(0, 6),
    mapping,
    rowCount: sheet.dataRows.length,
    headerRowNumber: sheet.headerRowIndex >= 0 ? sheet.headerRowIndex + 1 : null,
    usedSavedMapping: fromSaved !== null,
  };
  return NextResponse.json(body);
}

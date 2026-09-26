import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClubContextById } from "@/lib/auth/session";
import { ACTIVATE_MESSAGE, canWrite } from "@/lib/billing/status";
import type { Json } from "@/lib/db/types";
import { buildRosterPlan, type ExistingMember } from "@/lib/roster/normalise";
import { toSavedMapping } from "@/lib/roster/parse";
import { columnMappingSchema, previewReportSchema, type CommitResponse } from "@/lib/roster/schemas";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  importId: z.uuid(),
  mapping: columnMappingSchema,
  dryRun: z.boolean().default(true),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { importId, mapping, dryRun } = parsed.data;

  if (mapping.fullName === null && (mapping.firstName === null || mapping.lastName === null)) {
    return NextResponse.json({ error: "Choose a name column, or both first and last name columns" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: importRow } = await supabase
    .from("roster_imports")
    .select("id, club_id, status, report")
    .eq("id", importId)
    .maybeSingle();
  if (!importRow) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if (importRow.status !== "preview") return NextResponse.json({ error: "This import was already applied" }, { status: 409 });

  const ctx = await getClubContextById(importRow.club_id);
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if (!canWrite(ctx.club.billing_status)) return NextResponse.json({ error: ACTIVATE_MESSAGE }, { status: 402 });

  const report = previewReportSchema.safeParse(importRow.report);
  if (!report.success) return NextResponse.json({ error: "Import data is unreadable. Upload the file again." }, { status: 422 });
  const width = report.data.columns.length;
  if ([mapping.email, mapping.fullName, mapping.firstName, mapping.lastName].some((i) => i !== null && i >= width)) {
    return NextResponse.json({ error: "Invalid column mapping" }, { status: 400 });
  }

  const existing: ExistingMember[] = [];
  const currentRows: { id: string; email: string; status: string; name: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("memberships")
      .select("id, roster_email, roster_name, status")
      .eq("club_id", ctx.club.id)
      .order("id")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: "Could not read the current roster" }, { status: 500 });
    existing.push(...(data ?? []).map((m) => ({ email: m.roster_email, status: m.status })));
    currentRows.push(...(data ?? []).map((m) => ({ id: m.id, email: m.roster_email, status: m.status, name: m.roster_name })));
    if (!data || data.length < 1000) break;
  }

  const plan = buildRosterPlan(report.data.rows, mapping, existing, report.data.firstDataRowNumber);

  // People on the current list who are not in this file. Useful when the file
  // is a full membership export rather than a list of new joiners.
  const inFile = new Set([...plan.toAdd, ...plan.toRestore, ...plan.alreadyPresent].map((r) => r.email.toLowerCase()));
  const missing = currentRows
    .filter((m) => (m.status === "active" || m.status === "pending") && !inFile.has(m.email.toLowerCase()))
    .slice(0, 500)
    .map((m) => ({ id: m.id, name: m.name, email: m.email }));
  const summary: CommitResponse = {
    dryRun,
    rowCount: plan.rowCount,
    added: plan.toAdd.length,
    restored: plan.toRestore.length,
    alreadyPresent: plan.alreadyPresent.length,
    problems: plan.problems.slice(0, 1000),
    problemCount: plan.problems.length,
    missing,
  };
  if (dryRun) return NextResponse.json(summary);

  const now = new Date().toISOString();
  for (let i = 0; i < plan.toAdd.length; i += 500) {
    const chunk = plan.toAdd.slice(i, i + 500).map((row) => ({
      club_id: ctx.club.id,
      roster_email: row.email,
      roster_name: row.name,
      status: "pending",
      role: "club_member",
      invited_at: now,
    }));
    const { error } = await supabase
      .from("memberships")
      .upsert(chunk, { onConflict: "club_id,roster_email", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "Import stopped part way. Nothing after row " + (i + 1) + " was added." }, { status: 500 });
  }

  const restoreEmails = plan.toRestore.map((r) => r.email);
  for (let i = 0; i < restoreEmails.length; i += 500) {
    const emails = restoreEmails.slice(i, i + 500);
    const reset = { grace_started_at: null, grace_ends_at: null, grace_notices_sent: 0, invited_at: now };
    await supabase
      .from("memberships")
      .update({ ...reset, status: "active" })
      .eq("club_id", ctx.club.id)
      .in("roster_email", emails)
      .not("user_id", "is", null);
    await supabase
      .from("memberships")
      .update({ ...reset, status: "pending" })
      .eq("club_id", ctx.club.id)
      .in("roster_email", emails)
      .is("user_id", null);
  }

  await supabase
    .from("clubs")
    .update({ roster_mapping: toSavedMapping(report.data.columns, mapping) as unknown as Json })
    .eq("id", ctx.club.id);

  await supabase
    .from("roster_imports")
    .update({
      status: "committed",
      matched_count: plan.alreadyPresent.length,
      added_count: plan.toAdd.length + plan.toRestore.length,
      error_count: plan.problems.length,
      mapping: mapping as unknown as Json,
      report: { problems: plan.problems.slice(0, 1000), restored: plan.toRestore.length } as unknown as Json,
      imported_at: now,
    })
    .eq("id", importRow.id);

  revalidatePath(`/admin/${ctx.club.handle}/members`);
  return NextResponse.json({ ...summary, dryRun: false });
}

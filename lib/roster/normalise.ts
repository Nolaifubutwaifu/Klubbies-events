import { isValidEmail, normaliseEmail } from "./email";
import type { ColumnMapping, Grid } from "./parse";

export type RosterRow = { name: string; email: string };

export type RosterProblem = {
  row: number; // 1-based spreadsheet row
  name: string;
  email: string;
  reason: "missing email" | "invalid email" | "missing name" | "duplicate in file";
};

export type ExistingMember = { email: string; status: string };

export type RosterPlan = {
  rowCount: number;
  toAdd: RosterRow[];
  toRestore: RosterRow[];
  alreadyPresent: RosterRow[];
  problems: RosterProblem[];
};

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function extractRow(row: string[], mapping: ColumnMapping): RosterRow {
  const pick = (i: number | null) => (i === null ? "" : (row[i] ?? ""));
  const name =
    mapping.fullName !== null
      ? pick(mapping.fullName)
      : `${pick(mapping.firstName)} ${pick(mapping.lastName)}`;
  return { name: cleanName(name), email: normaliseEmail(pick(mapping.email)) };
}

/**
 * Normalises and deduplicates rows, then compares them with the current
 * roster. Import is additive: members already on the roster are left alone;
 * people in grace or revoked are restored.
 */
export function buildRosterPlan(
  rows: Grid,
  mapping: ColumnMapping,
  existing: ExistingMember[],
  firstDataRowNumber: number,
): RosterPlan {
  const existingByEmail = new Map(existing.map((m) => [normaliseEmail(m.email), m.status]));
  const seen = new Set<string>();
  const plan: RosterPlan = { rowCount: 0, toAdd: [], toRestore: [], alreadyPresent: [], problems: [] };

  rows.forEach((raw, index) => {
    if (raw.every((cell) => cell.trim() === "")) return;
    plan.rowCount++;
    const rowNumber = firstDataRowNumber + index;
    const { name, email } = extractRow(raw, mapping);

    let reason: RosterProblem["reason"] | null = null;
    if (!email) reason = "missing email";
    else if (!isValidEmail(email)) reason = "invalid email";
    else if (!name) reason = "missing name";
    else if (seen.has(email)) reason = "duplicate in file";

    if (reason) {
      plan.problems.push({ row: rowNumber, name, email, reason });
      return;
    }

    seen.add(email);
    const status = existingByEmail.get(email);
    if (status === undefined) plan.toAdd.push({ name, email });
    else if (status === "grace" || status === "revoked") plan.toRestore.push({ name, email });
    else plan.alreadyPresent.push({ name, email });
  });

  return plan;
}

export function problemsToCsv(problems: Pick<RosterProblem, "row" | "name" | "email">[] & { reason: string }[]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [["Row", "Name", "Email", "Problem"].join(",")];
  for (const p of problems) lines.push([String(p.row), p.name, p.email, p.reason].map(escape).join(","));
  return lines.join("\n");
}

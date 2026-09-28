import { requireOps, usageCsv, usageReport } from "@/lib/usage/report";

/** The usage view as a spreadsheet (CSV opens in Excel and Numbers). */
export async function GET() {
  await requireOps();
  const csv = usageCsv(await usageReport());
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="klubbies-events-usage-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}

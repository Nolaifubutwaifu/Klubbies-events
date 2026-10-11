import type { Metadata } from "next";
import { SimpleHeader } from "@/components/SimpleHeader";
import { PageTitle } from "@/components/ui";
import { getProfile } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { requireOps, usageReport } from "@/lib/usage/report";

export const metadata: Metadata = { title: "Usage", robots: { index: false, follow: false } };

function pct(value: number | null): string {
  return value === null ? "" : `${Math.round(value * 100)}%`;
}

/**
 * Every event's usage and estimated cost (pricing handoff §5.8), for Max.
 * Totals refresh hourly and are kept after an event's photos are deleted.
 */
const RANGES = [
  ["90d", "Last 90 days"],
  ["year", "This year"],
  ["all", "All time"],
] as const;

/** The earliest creation date a range keeps, or null for all time. */
function rangeStart(range: string): number | null {
  const now = new Date();
  if (range === "90d") return now.getTime() - 90 * 86_400_000;
  if (range === "year") return new Date(now.getFullYear(), 0, 1).getTime();
  return null;
}

export default async function UsagePage(props: PageProps<"/ops/usage">) {
  await requireOps();
  const search = await props.searchParams;
  const range = typeof search.range === "string" && RANGES.some(([key]) => key === search.range) ? search.range : "all";
  const since = rangeStart(range);
  const [allRows, profile] = await Promise.all([usageReport(), getProfile()]);
  const rows = since === null ? allRows : allRows.filter((r) => new Date(r.createdAt).getTime() >= since);
  const paid = rows.filter((r) => r.paidAud > 0);
  const revenue = paid.reduce((sum, r) => sum + r.paidAud, 0);
  const cost = rows.reduce((sum, r) => sum + r.cost.totalAud, 0);
  const paidCost = paid.reduce((sum, r) => sum + r.cost.totalAud, 0);
  const joined = rows.filter((r) => r.guestsJoined > 0);
  const avg = (values: (number | null)[]) => {
    const real = values.filter((v): v is number => v !== null);
    return real.length ? real.reduce((a, b) => a + b, 0) / real.length : null;
  };

  return (
    <main className="flex flex-1 flex-col">
      <SimpleHeader name={profile?.display_name ?? profile?.email ?? "You"} />
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle title="Usage">Every event, what it used and what it cost us. Totals refresh hourly.</PageTitle>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map(([key, label]) => (
              <a
                key={key}
                href={key === "all" ? "/ops/usage" : `/ops/usage?range=${key}`}
                aria-current={range === key ? "page" : undefined}
                className={`flex min-h-[40px] items-center rounded-[8px] border px-3.5 text-[14px] font-medium no-underline ${
                  range === key
                    ? "border-[color:var(--kb-ink)] bg-[color:var(--kb-ink)] text-white"
                    : "border-[color:var(--kb-line)] bg-white text-[color:var(--kb-ink-2)] hover:border-[color:var(--kb-line-strong)]"
                }`}
              >
                {label}
              </a>
            ))}
            <a href="/ops/usage/csv" className="btn btn-secondary no-underline" download>
              Download spreadsheet
            </a>
          </div>
        </div>
        <section aria-label="Totals" className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {[
            ["Events", rows.length.toLocaleString("en-AU"), `${paid.length} paid · ${rows.length - paid.length} free`],
            ["Revenue", `A$${revenue.toFixed(2)}`, "Paid in, before Stripe fees"],
            ["Estimated cost", `A$${cost.toFixed(2)}`, "Storage, face search, egress"],
            ["Margin", revenue ? pct((revenue - paidCost) / revenue) : "", "Across paid events"],
          ].map(([label, value, hint]) => (
            <div key={label} className="flex flex-col gap-1.5 rounded-[10px] border border-[color:var(--kb-line)] bg-white px-5 py-[18px]">
              <span className="text-[14px] text-[color:var(--kb-ink-2)]">{label}</span>
              <span className="mono text-[28px] font-medium leading-none tracking-[-0.02em]">{value || "–"}</span>
              <span className="text-[14px] text-[color:var(--kb-ink-3)]">{hint}</span>
            </div>
          ))}
        </section>
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white">
          <table className="kb-table min-w-[1100px] text-[14px]">
            <thead>
              <tr>
                {["Event", "Size", "Paid", "Source", "Guests", "Join", "Selfie", "Download", "Photos", "Video min", "GB", "Face calls", "Downloads", "To first photos", "Est. cost", "Margin"].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.eventId}>
                  <th scope="row" className="text-left font-medium">
                    <span className="block">{r.name}</span>
                    <span className="block font-normal text-[color:var(--kb-ink-3)]">
                      {formatDate(r.createdAt)}
                      {r.deleted ? " · in bin" : ""}
                    </span>
                  </th>
                  <td className="whitespace-nowrap">
                    {r.plan}
                    {r.rate === "club" ? " (club)" : ""}
                  </td>
                  <td className="mono">{r.paidAud ? `A$${r.paidAud.toFixed(2)}` : ""}</td>
                  <td>{r.source}</td>
                  <td className="mono">
                    {r.guestsJoined}
                    {r.expectedGuests ? ` / ${r.expectedGuests}` : ""}
                  </td>
                  <td className="mono">{pct(r.joinRate)}</td>
                  <td className="mono">{pct(r.selfieRate)}</td>
                  <td className="mono">{pct(r.downloadRate)}</td>
                  <td className="mono">{r.photos}</td>
                  <td className="mono">{r.videoMinutes || ""}</td>
                  <td className="mono">{r.storageGb}</td>
                  <td className="mono">{r.faceCalls}</td>
                  <td className="mono">
                    {r.downloads}
                    {r.zips ? ` + ${r.zips} zips` : ""}
                  </td>
                  <td className="mono">{r.daysToFirstPhotos === null ? "" : `${r.daysToFirstPhotos} days`}</td>
                  <td className="mono">A${r.cost.totalAud.toFixed(2)}</td>
                  <td className="mono">{pct(r.cost.margin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[color:var(--kb-line)] font-semibold">
                <td>Total</td>
                <td />
                <td className="mono">A${revenue.toFixed(2)}</td>
                <td />
                <td className="mono">{rows.reduce((sum, r) => sum + r.guestsJoined, 0)}</td>
                <td />
                <td />
                <td />
                <td className="mono">{rows.reduce((sum, r) => sum + r.photos, 0)}</td>
                <td className="mono">{Math.round(rows.reduce((sum, r) => sum + r.videoMinutes, 0) * 10) / 10}</td>
                <td />
                <td className="mono">{rows.reduce((sum, r) => sum + r.faceCalls, 0)}</td>
                <td className="mono">{rows.reduce((sum, r) => sum + r.downloads, 0)}</td>
                <td />
                <td className="mono">A${cost.toFixed(2)}</td>
                <td className="mono">{revenue ? pct((revenue - paidCost) / revenue) : ""}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          Join, Selfie and Download are shares of guests. Across events with guests: join {pct(avg(joined.map((r) => r.joinRate)))}, selfie{" "}
          {pct(avg(joined.map((r) => r.selfieRate)))}, download {pct(avg(joined.map((r) => r.downloadRate)))}. Costs use the rates in the
          retention handoff, with storage counted for the whole 12 months.
        </p>
      </div>
    </main>
  );
}

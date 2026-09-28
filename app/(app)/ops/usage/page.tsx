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
export default async function UsagePage() {
  await requireOps();
  const [rows, profile] = await Promise.all([usageReport(), getProfile()]);
  const paid = rows.filter((r) => r.paidAud > 0);
  const revenue = paid.reduce((sum, r) => sum + r.paidAud, 0);
  const cost = rows.reduce((sum, r) => sum + r.cost.totalAud, 0);
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
          <PageTitle title="Usage">
            {rows.length} events, {paid.length} paid. A${revenue.toFixed(2)} taken, about A${cost.toFixed(2)} in lifetime costs.
          </PageTitle>
          <a href="/ops/usage/csv" className="btn btn-secondary no-underline" download>
            Download spreadsheet
          </a>
        </div>
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          Across events with guests: join rate {pct(avg(joined.map((r) => r.joinRate)))}, selfie rate{" "}
          {pct(avg(joined.map((r) => r.selfieRate)))}, download rate {pct(avg(joined.map((r) => r.downloadRate)))}. Costs use
          the rates in the retention handoff; storage is counted for the whole 12 months.
        </p>
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--kb-line)] bg-white">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[14px]">
            <thead className="text-[color:var(--kb-ink-3)]">
              <tr>
                {["Event", "Size", "Paid", "Source", "Guests", "Join", "Selfie", "Download", "Photos", "Video min", "GB", "Face calls", "Downloads", "To first photos", "Est. cost", "Margin"].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.eventId} className="border-t border-[color:var(--kb-line)]">
                  <th scope="row" className="px-3 py-2 font-medium">
                    <span className="block">{r.name}</span>
                    <span className="block font-normal text-[color:var(--kb-ink-3)]">
                      {formatDate(r.createdAt)}
                      {r.deleted ? " · in bin" : ""}
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.plan}
                    {r.rate === "club" ? " (club)" : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.paidAud ? `A$${r.paidAud.toFixed(2)}` : ""}</td>
                  <td className="px-3 py-2">{r.source}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.guestsJoined}
                    {r.expectedGuests ? ` / ${r.expectedGuests}` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.joinRate)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.selfieRate)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.downloadRate)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.photos}</td>
                  <td className="px-3 py-2 tabular-nums">{r.videoMinutes || ""}</td>
                  <td className="px-3 py-2 tabular-nums">{r.storageGb}</td>
                  <td className="px-3 py-2 tabular-nums">{r.faceCalls}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.downloads}
                    {r.zips ? ` + ${r.zips} zips` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.daysToFirstPhotos === null ? "" : `${r.daysToFirstPhotos} days`}</td>
                  <td className="px-3 py-2 tabular-nums">A${r.cost.totalAud.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.cost.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

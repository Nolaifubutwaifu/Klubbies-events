/**
 * Organiser pages took 2.5 to 3 seconds on a phone with the old page still
 * showing and nothing to say a tap had worked. A skeleton in the page's shape,
 * as on the event home, never a spinner.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 pb-12 pt-2" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <span className="soft-skeleton h-[14px] w-[120px] !rounded-[4px]" />
        <span className="soft-skeleton h-[32px] w-[min(320px,80%)] !rounded-[6px]" />
        <span className="soft-skeleton h-[16px] w-[min(420px,95%)] !rounded-[4px]" />
      </div>
      <span className="soft-skeleton block h-[140px] w-full !rounded-[var(--kb-r-card)]" />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="soft-skeleton block h-[110px] !rounded-[var(--kb-r-card)]" />
        ))}
      </div>
    </div>
  );
}

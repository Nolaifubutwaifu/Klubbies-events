/**
 * What the event home is about to look like. The design is explicit about
 * this: a skeleton in the page's own shape, never a spinner in the middle of
 * an empty screen.
 */
export default function EventLoading() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12" aria-busy="true" aria-label="Loading the event">
      <div className="flex flex-col gap-3 border-b border-[color:var(--kb-line)] pb-8">
        <span className="soft-skeleton h-[16px] w-[160px] !rounded-[4px]" />
        <span className="soft-skeleton h-[56px] w-[min(520px,90%)] !rounded-[6px]" />
        <span className="soft-skeleton h-[16px] w-[260px] !rounded-[4px]" />
      </div>
      <span className="soft-skeleton mt-6 block h-[96px] w-full !rounded-[var(--kb-r-card)]" />
      <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <span className="soft-skeleton block aspect-[4/3] w-full !rounded-[var(--kb-r-card)]" />
            <span className="soft-skeleton h-[18px] w-[160px] !rounded-[4px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

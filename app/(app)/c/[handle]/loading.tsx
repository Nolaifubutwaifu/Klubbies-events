/**
 * What the member home is about to look like. The design is explicit about
 * this: a skeleton in the page's own shape, never a spinner in the middle of
 * an empty screen.
 */
export default function ClubLoading() {
  return (
    <div className="w-full px-4 pb-16 pt-6 sm:px-6" aria-busy="true" aria-label="Loading albums">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <span className="soft-skeleton h-[26px] w-[110px] !rounded-full" />
          <span className="soft-skeleton h-[40px] w-[260px]" />
          <span className="soft-skeleton h-[16px] w-[200px] !rounded-full" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-[300px]">
          <span className="soft-skeleton h-[46px] w-full !rounded-full" />
          <div className="flex gap-2">
            <span className="soft-skeleton h-[44px] w-[92px] !rounded-full" />
            <span className="soft-skeleton h-[44px] w-[128px] !rounded-full" />
          </div>
        </div>
      </div>

      <span className="soft-skeleton mt-6 block aspect-[21/9] w-full !rounded-[var(--soft-r)]" />

      <div className="mt-6 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="soft-card flex flex-col gap-3 overflow-hidden !p-0">
            <span className="soft-skeleton block aspect-[16/10] w-full !rounded-none" />
            <div className="flex flex-col gap-2 p-3.5 pt-0">
              <span className="soft-skeleton h-[22px] w-[130px] !rounded-full" />
              <span className="soft-skeleton h-[22px] w-[180px] !rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

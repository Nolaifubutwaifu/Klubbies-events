/** The album in outline: header, filters, then the grid filling in. */
export default function AlbumLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading this album">
      <div className="flex w-full flex-wrap items-center gap-4 border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] px-4 py-3.5 sm:px-6">
        <span className="soft-skeleton h-11 w-11 flex-none !rounded-full" />
        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <span className="soft-skeleton h-[26px] w-[220px]" />
          <span className="soft-skeleton h-[14px] w-[300px] !rounded-full" />
        </div>
        <span className="soft-skeleton h-11 w-[150px] !rounded-full" />
      </div>

      <div className="flex w-full flex-wrap gap-2 px-4 pt-4 sm:px-6">
        {[72, 96, 104].map((w) => (
          <span key={w} className="soft-skeleton h-[38px] !rounded-full" style={{ width: w }} />
        ))}
      </div>

      <div
        className="grid w-full gap-1 px-1 pb-6 pt-3 sm:gap-1.5 sm:px-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(104px, 14vw, 168px), 1fr))" }}
      >
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="soft-skeleton block aspect-square !rounded-[10px]" />
        ))}
      </div>
    </div>
  );
}

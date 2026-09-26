/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import { plural } from "@/lib/format";

export type Season = {
  year: number;
  albums: number;
  photos: number;
  people: string[];
  tiles: string[];
};

/**
 * A club's history doesn't graduate with its media officer. Every past year is
 * still here, still the club's, and this is where a new committee sees that.
 */
export function PastSeasons({ seasons }: { seasons: Season[] }) {
  if (!seasons.length) return null;

  return (
    <section className="soft-card flex flex-col gap-4 p-5">
      <div>
        <h2 className="soft-display text-[19px]">Past seasons</h2>
        <p className="m-0 mt-1 text-[14px] text-[color:var(--ink-70)]">
          Archived, not deleted. Every album a past committee made still belongs to the club.
        </p>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {seasons.map((season) => (
          <div
            key={season.year}
            className="flex flex-col gap-2.5 rounded-[16px] border border-[color-mix(in_srgb,var(--color-text)_7%,transparent)] bg-[color:var(--color-bg)] p-3.5"
          >
            <div>
              <span className="soft-display block text-[17px]">
                {season.year}
                {season.people.length ? ` · ${season.people.slice(0, 2).join(", ")}` : ""}
              </span>
              <span className="block text-[14px] text-[color:var(--ink-70)]">
                {plural(season.albums, "album")} · {season.photos.toLocaleString("en-AU")}{" "}
                {season.photos === 1 ? "photo" : "photos"}
              </span>
            </div>
            {season.tiles.length ? (
              <div className="flex gap-1.5">
                {season.tiles.slice(0, 3).map((url, i) => (
                  <span key={`${season.year}-${i}`} className="h-[54px] flex-1 overflow-hidden rounded-[10px] bg-[color:var(--tone-support)]">
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

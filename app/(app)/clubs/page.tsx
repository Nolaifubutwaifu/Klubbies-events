import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { InviteCard } from "@/components/InviteCard";
import { Brand, EmptyState, PageTitle } from "@/components/ui";
import { PhotoStackArt } from "@/components/soft/illustrations";
import { getProfile, listMyClubs, requireUser } from "@/lib/auth/session";
import { formatDate, formatLongDate, plural } from "@/lib/format";
import { listClubCards } from "@/lib/media/club-cards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your clubs" };

export default async function ClubsPage() {
  const user = await requireUser("/clubs");
  const [{ clubs, invites }, profile] = await Promise.all([listMyClubs(), getProfile()]);
  const cards = await listClubCards(await createClient(), clubs.map((c) => c.clubId), user.id);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[color:var(--kb-line)] px-4 py-3 sm:px-6">
        <Brand href="/clubs" size={24} />
        <AccountMenu name={profile?.display_name ?? profile?.email ?? "You"} />
      </header>

      <div className="flex flex-col gap-6 px-6 py-8">
        <PageTitle title="Your clubs">
          Pick a club to see its event albums.
        </PageTitle>

        {invites.length ? (
          <section>
            <span className="soft-display text-[17px]">Invitations</span>
            {invites.map((invite) => (
              <InviteCard key={invite.membershipId} invite={invite} />
            ))}
          </section>
        ) : null}

        {clubs.length === 0 ? (
          <EmptyState
            title={invites.length ? "Accept an invitation to get started" : "You're not on any club list yet"}
            art={<PhotoStackArt size={120} />}
            action={
              <Link href="/admin/new" className="btn btn-primary">
                Start your club
              </Link>
            }
          >
            {invites.length
              ? "Your clubs appear here once you accept."
              : `Ask your committee to add ${profile?.email ?? "your email"} to their member list, or start your own club.`}
          </EmptyState>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {clubs.map((club) => {
              const card = cards.get(club.clubId);
              return (
                <Link
                  key={club.membershipId}
                  href={`/c/${club.handle}`}
                  aria-label={`${club.name}, ${card?.albumCount ? plural(card.albumCount, "album") : "nothing uploaded yet"}${card?.newCount ? `, ${card.newCount} new` : ""}`}
                  className="soft-card group flex flex-col overflow-hidden !p-0 text-ink no-underline"
                >
                  {/* The photos are the point, so they lead. */}
                  <span className="relative block aspect-[16/10] bg-[color:var(--tone-support)]">
                    {card?.tiles.length ? (
                      <span
                        className="grid h-full w-full gap-[2px]"
                        style={{
                          gridTemplateColumns: card.tiles.length > 1 ? "repeat(3, minmax(0, 1fr))" : "1fr",
                          gridTemplateRows: card.tiles.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr",
                        }}
                      >
                        {card.tiles.slice(0, 3).map((url, i) => (
                          // The skeleton sits under each image, so a slow
                          // collage shimmers instead of showing a flat box.
                          <span
                            key={url}
                            className="soft-skeleton block overflow-hidden !rounded-none"
                            style={i === 0 && card.tiles.length > 1 ? { gridColumn: "span 2", gridRow: "span 2" } : undefined}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img src={url} alt="" loading="lazy" className="relative z-[1] h-full w-full object-cover" />
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[14px] text-[color:var(--ink-55)]">
                        <span className="text-accent-400">
                          <PhotoStackArt size={92} />
                        </span>
                        {card && card.itemCount > 0 ? "Previews still processing" : "No photos yet"}
                      </span>
                    )}
                    {card && card.newCount > 0 ? (
                      <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-[14px] font-bold text-white">
                        {card.newCount} new
                      </span>
                    ) : null}
                    {club.status === "grace" ? (
                      <span className="absolute right-3 top-3 rounded-full bg-[rgba(25,18,22,0.72)] px-3 py-1 text-[14px] font-bold text-white">
                        Access ends {formatDate(club.graceEndsAt)}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex flex-1 flex-col gap-2 p-5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={club.isAdmin ? "soft-chip" : "soft-chip soft-chip-muted"}>{club.roleName}</span>
                      {club.organisation ? (
                        <span className="text-[14px] text-[color:var(--ink-55)]">{club.organisation}</span>
                      ) : null}
                    </span>
                    <span className="soft-display text-[24px]">{club.name}</span>
                    <span className="text-[14px] text-[color:var(--ink-70)]">
                      {card && card.albumCount
                        ? `${plural(card.albumCount, "album")} · ${plural(card.itemCount, "photo or video", "photos and videos")}`
                        : "Nothing uploaded yet"}
                    </span>
                    {card?.latestTitle ? (
                      <span className="mt-auto pt-2 text-[14px] text-[color:var(--ink-55)]">
                        Latest: {card.latestTitle}
                        {card.latestDate ? ` · ${formatDate(card.latestDate)}` : ""}
                      </span>
                    ) : (
                      <span className="mt-auto pt-2 text-[14px] text-[color:var(--ink-55)]">
                        Member since {formatLongDate(club.since)}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <Link href="/admin/new" className="kb-link self-start">
          Start another club
        </Link>
      </div>
    </main>
  );
}

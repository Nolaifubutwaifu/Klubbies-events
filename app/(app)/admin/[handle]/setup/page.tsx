/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { canWrite } from "@/lib/billing/status";
import { clubAddress } from "@/lib/env";
import { listStackedAlbums } from "@/lib/media/album-list";
import { SIGNED_URL_TTL, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your club" };

type Step = {
  key: string;
  title: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
};

function Tick({ done, index }: { done: boolean; index: number }) {
  return (
    <span
      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[14px] font-extrabold"
      style={
        done
          ? { background: "var(--color-accent)", color: "#fff" }
          : { background: "color-mix(in srgb, var(--color-text) 7%, transparent)", color: "var(--color-neutral-700)" }
      }
      aria-hidden
    >
      {done ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      ) : (
        index
      )}
    </span>
  );
}

export default async function SetupPage(props: PageProps<"/admin/[handle]/setup">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();

  const [{ count: members }, albums] = await Promise.all([
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("club_id", ctx.club.id)
      .in("status", ["pending", "active", "grace"]),
    listStackedAlbums(supabase, ctx.club.id, { includeDrafts: true, limit: 6 }),
  ]);

  const tiles = albums.flatMap((album) => album.tiles).slice(0, 6);
  const logoUrl = ctx.club.logo_path
    ? ((await signPaths(supabase, [ctx.club.logo_path], SIGNED_URL_TTL.display)).get(ctx.club.logo_path) ?? null)
    : null;

  const steps: Step[] = [
    {
      key: "name",
      title: "Name your club",
      hint: ctx.club.name,
      done: true,
      href: `/admin/${handle}/settings`,
      cta: "Change it",
    },
    {
      key: "handle",
      title: "Pick a handle",
      hint: clubAddress(ctx.club.handle),
      done: true,
      href: `/admin/${handle}/settings`,
      cta: "Open settings",
    },
    {
      key: "look",
      title: "Logo and colour",
      hint: logoUrl ? "Set — every highlight follows your colour" : "A square mark and one colour, and the app is yours",
      done: Boolean(logoUrl && ctx.club.accent_colour),
      href: `/admin/${handle}/settings`,
      cta: logoUrl ? "Change it" : "Add a logo",
    },
    {
      key: "roster",
      title: "Bring your member list",
      hint:
        (members ?? 0) > 1
          ? `${(members ?? 0).toLocaleString("en-AU")} on the list`
          : "This list is the door: anyone on it can sign in, anyone else gets a locked page",
      done: (members ?? 0) > 1,
      href: `/admin/${handle}/members`,
      cta: (members ?? 0) > 1 ? "Open members" : "Import a CSV",
    },
    {
      key: "album",
      title: "Make your first album",
      hint: albums.length ? `${albums.length} album${albums.length === 1 ? "" : "s"} so far` : "Even if it's last year's photos",
      done: albums.length > 0,
      href: `/admin/${handle}/upload`,
      cta: albums.length ? "New album" : "Upload something",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <main className="grid gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* The rail: five steps, once, and a bar that shows there's an end to it. */}
      <aside className="soft-card flex flex-col gap-4 p-5 lg:sticky lg:top-5 lg:self-start">
        <div>
          <span className="soft-chip">Setting up</span>
          <h1 className="soft-display mt-3 text-[clamp(24px,3vw,30px)]">Set up {ctx.club.name}</h1>
          <p className="mt-2 text-[14px] text-[color:var(--ink-70)]">
            Five minutes, once. Then every event is a drag and drop.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-[8px] flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]">
            <span
              className="block h-full rounded-full transition-[width]"
              style={{
                width: `${(doneCount / steps.length) * 100}%`,
                background: "linear-gradient(90deg, var(--color-accent-600), var(--color-accent-800))",
              }}
            />
          </span>
          <span className="flex-none text-[14px] font-bold text-[color:var(--ink-70)]">
            {doneCount} of {steps.length}
          </span>
        </div>

        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3">
              <Tick done={step.done} index={index + 1} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold" style={step.done ? { color: "var(--color-neutral-700)" } : undefined}>
                  {step.title}
                </span>
                <span className="block text-[14px] text-[color:var(--ink-55)]">{step.hint}</span>
              </span>
              <Link href={step.href} className="flex-none text-[14px] font-bold no-underline">
                {step.cta}
              </Link>
            </li>
          ))}
        </ol>

        {canWrite(ctx.club.billing_status) ? null : (
          <div className="rounded-[var(--soft-r-sm)] bg-[color:var(--tone-support)] p-4 text-[color:var(--tone-support-ink)]">
            <span className="block text-[14px] font-bold">Nothing is charged yet</span>
            <p className="m-0 mt-1 text-[14px]">A$20 a month starts when you activate the club, which unlocks adding members and uploading.</p>
            <Link href={`/admin/${handle}/billing`} className="mt-2 inline-block text-[14px] font-bold">
              See the plan
            </Link>
          </div>
        )}
      </aside>

      <div className="flex flex-col gap-6">
        {next ? (
          <section className="soft-card flex flex-col items-start gap-3 p-6">
            <span className="soft-chip">Next up</span>
            <h2 className="soft-display text-[clamp(22px,3vw,30px)]">{next.title}</h2>
            <p className="m-0 max-w-[52ch] text-[15px] text-[color:var(--ink-70)]">{next.hint}</p>
            <Link href={next.href} className="soft-btn soft-btn-primary no-underline">
              {next.cta}
            </Link>
          </section>
        ) : (
          <section className="soft-card flex flex-col items-start gap-3 p-6">
            <span className="soft-chip">All done</span>
            <h2 className="soft-display text-[clamp(22px,3vw,30px)]">You&apos;re set up.</h2>
            <p className="m-0 max-w-[52ch] text-[15px] text-[color:var(--ink-70)]">
              Everything from here is uploading a night and letting it go live.
            </p>
            <Link href={`/admin/${handle}`} className="soft-btn soft-btn-primary no-underline">
              Open the dashboard
            </Link>
          </section>
        )}

        <section className="soft-card flex flex-col gap-4 p-6">
          <div>
            <h2 className="soft-display text-[20px]">What your members will see</h2>
            <p className="m-0 mt-1 max-w-[56ch] text-[15px] text-[color:var(--ink-70)]">
              They sign in with the email on your list and land straight in your albums. No password, no invite code to
              lose.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="soft-chip soft-chip-muted">No public links</span>
            <span className="soft-chip soft-chip-muted">Not indexed</span>
            <span className="soft-chip soft-chip-muted">Full quality downloads</span>
          </div>

          <div className="max-w-[340px] rounded-[var(--soft-r)] bg-[color:var(--color-bg)] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-[11px] bg-accent text-[14px] font-extrabold text-white">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  ctx.club.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <span>
                <span className="block text-[14px] font-bold">{ctx.club.name}</span>
                <span className="block text-[14px] text-[color:var(--ink-55)]">Your albums</span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {(tiles.length ? tiles : Array.from({ length: 6 }, (_, i) => ({ id: `blank-${i}`, url: null }))).map((tile) => (
                <span key={tile.id} className="soft-tile aspect-square">
                  {tile.url ? <img src={tile.url} alt="" loading="lazy" /> : null}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

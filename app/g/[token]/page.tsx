import type { Metadata } from "next";
import { formatLongDate } from "@/lib/format";
import { resolveGuestLink, type GuestLinkState } from "@/lib/guest/links";
import { clubToneStyle } from "@/lib/theme";
import { GuestUploader } from "./GuestUploader";

// A guest link is the only part of Klubbies that works without an account, so
// it is deliberately small: one album, upload only, nothing else on the page.
export const metadata: Metadata = { title: "Upload", robots: { index: false, follow: false } };

const DEAD: Record<Exclude<GuestLinkState, "ok">, { title: string; body: string }> = {
  unknown: {
    title: "This link doesn't work.",
    body: "Check you copied the whole thing, including the dashes. If it still won't open, ask the committee for a fresh one.",
  },
  revoked: {
    title: "This link has been turned off.",
    body: "Anything you already uploaded is safe with the club. Ask the committee to reissue the link if you have more to add.",
  },
  expired: {
    title: "This link has expired.",
    body: "Guest links run out on a date the committee picks. Ask them to reissue it and you'll get a new one.",
  },
  unpaid: {
    title: "This club isn't active right now.",
    body: "Uploads are paused until the committee sorts their subscription. Nothing you already sent has been lost.",
  },
};

export default async function GuestUploadPage(props: PageProps<"/g/[token]">) {
  const { token } = await props.params;
  const { state, session } = await resolveGuestLink(token);

  if (!session) {
    const copy = DEAD[state as Exclude<GuestLinkState, "ok">] ?? DEAD.unknown;
    return (
      <div className="theme-soft relative flex min-h-dvh flex-col">
        <main className="relative z-10 mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-4 px-5 py-14">
          <span className="soft-wordmark text-[22px]">klubbies</span>
          <h1 className="text-[clamp(28px,6vw,38px)]">{copy.title}</h1>
          <p className="m-0 text-[15px] text-[color:var(--ink-70)]">{copy.body}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="theme-soft relative flex min-h-dvh flex-col" style={clubToneStyle(session.clubAccent)}>
      <main className="relative z-10 mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="soft-wordmark text-[20px]">klubbies</span>
          <span className="soft-chip soft-chip-muted">Guest upload · expires {formatLongDate(session.expiresAt)}</span>
        </div>

        <div>
          <span className="soft-chip">Upload for {session.clubName}</span>
          <h1 className="mt-3 text-[clamp(28px,5.5vw,40px)]">{session.albumTitle}</h1>
          <p className="mt-2 text-[15px] text-[color:var(--ink-70)]">
            {session.albumDate ? `${formatLongDate(session.albumDate)} · ` : ""}
            Hi {session.label.split("—")[0].trim()}. Drop the night in and close the tab.
          </p>
        </div>

        <GuestUploader token={token} />

        <div className="rounded-[var(--soft-r)] bg-[color:var(--tone-support)] p-5 text-[color:var(--tone-support-ink)]">
          <span className="block text-[14px] font-bold">You can&apos;t see the club&apos;s albums from here.</span>
          <p className="m-0 mt-1 text-[14px]">
            This link only adds files to {session.albumTitle}. No login, no member list, no other albums. Everything you
            add shows as &ldquo;added by guest&rdquo; in the committee&apos;s album.
          </p>
          {session.fileCount > 0 ? (
            <p className="m-0 mt-2 text-[14px]">
              {session.fileCount.toLocaleString("en-AU")} file{session.fileCount === 1 ? "" : "s"} already came in on this
              link.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

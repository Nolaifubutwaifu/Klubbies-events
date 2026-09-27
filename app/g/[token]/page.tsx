import type { Metadata } from "next";
import { EventMark } from "@/components/EventMark";
import { Brand } from "@/components/ui";
import { formatLongDate } from "@/lib/format";
import { resolveGuestLink, type GuestLinkState } from "@/lib/guest/links";
import { signLogoMarks } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventToneStyle } from "@/lib/theme";
import { GuestUploader } from "./GuestUploader";

// A photographer's upload link is the only part of the product that works
// without an account, so it is deliberately small: one album, upload only.
export const metadata: Metadata = { title: "Upload", robots: { index: false, follow: false } };

const DEAD: Record<Exclude<GuestLinkState, "ok">, { title: string; body: string }> = {
  unknown: {
    title: "This link doesn't work.",
    body: "Check you copied the whole thing, including the dashes. If it still won't open, ask the organiser for a fresh one.",
  },
  revoked: {
    title: "This link has been turned off.",
    body: "Anything you already uploaded is safe with the event. Ask the organiser for a new link if you have more to add.",
  },
  expired: {
    title: "This link has expired.",
    body: "Upload links run out on a date the organiser picks. Ask them for a new one.",
  },
  unpaid: {
    title: "This event isn't active right now.",
    body: "Uploads are paused until the organiser activates the event. Nothing you already sent has been lost.",
  },
};

export default async function GuestUploadPage(props: PageProps<"/g/[token]">) {
  const { token } = await props.params;
  const { state, session } = await resolveGuestLink(token);

  if (!session) {
    const copy = DEAD[state as Exclude<GuestLinkState, "ok">] ?? DEAD.unknown;
    return (
      <div className="theme-soft relative flex min-h-dvh flex-col">
        <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-4 px-5 py-14">
          <Brand />
          <h1 className="text-[clamp(26px,6vw,34px)]">{copy.title}</h1>
          <p className="m-0 text-[15px] text-[color:var(--ink-70)]">{copy.body}</p>
        </main>
      </div>
    );
  }

  // The link is the credential here, so the logo is signed with the service
  // role after the link checked out. It is the only image this page shows.
  const logoUrl = session.eventLogoPath
    ? ((await signLogoMarks(createAdminClient(), [session.eventLogoPath])).get(session.eventLogoPath) ?? null)
    : null;
  const name = session.label.trim();

  return (
    <div className="theme-soft relative flex min-h-dvh flex-col" style={eventToneStyle(session.eventAccent)}>
      <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
        <div className="mx-auto flex min-h-[60px] w-full max-w-[760px] items-center justify-between gap-3 px-5">
          <span className="flex min-w-0 items-center gap-2.5">
            <EventMark name={session.eventName} logoUrl={logoUrl} accentColour={session.eventAccent} size={30} />
            <span className="truncate text-[15px] font-semibold">{session.eventName}</span>
          </span>
          <span className="text-[14px] text-[color:var(--kb-ink-3)]">Link expires {formatLongDate(session.expiresAt)}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-5 py-10">
        <div>
          <span className="kb-eyebrow">Uploading as {name}</span>
          <h1 className="serif mt-2 text-[clamp(36px,6vw,52px)]">{session.albumTitle}</h1>
          <p className="m-0 mt-2 text-[15px] text-[color:var(--ink-70)]">
            {session.albumDate ? `${formatLongDate(session.albumDate)} · ` : ""}
            Full resolution JPG, HEIC, PNG, MP4 or MOV. Every photo is credited to you.
          </p>
        </div>

        <GuestUploader token={token} />

        <div className="kb-info flex-col">
          <span className="text-[14px] font-medium">Keep this tab open until the list says done.</span>
          <p className="m-0 text-[14px]">
            If the connection drops, open this link again and drop the same files: finished ones are skipped and the rest
            carry on. This link only adds photos to {session.albumTitle}; it can&apos;t open the gallery.
          </p>
          {session.fileCount > 0 ? (
            <p className="m-0 text-[14px]">
              {session.fileCount.toLocaleString("en-AU")} file{session.fileCount === 1 ? "" : "s"} already came in on this link.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

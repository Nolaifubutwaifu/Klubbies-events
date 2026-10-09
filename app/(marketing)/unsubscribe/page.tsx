import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui";
import { announcementOptOutToken } from "@/lib/events/announcements";
import { unsubscribeToken, type NotifyKind } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnnouncementOptOutButton, UnsubscribeButton } from "./UnsubscribeButton";

export const metadata: Metadata = { title: "Email settings" };

const LABELS: Record<NotifyKind, string> = {
  notify_new_album: "emails about new albums",
  notify_access_ending: "reminders that a gallery is about to close",
};

function isKind(value: unknown): value is NotifyKind {
  return value === "notify_new_album" || value === "notify_access_ending";
}

export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const params = await props.searchParams;
  const userId = typeof params.u === "string" ? params.u : "";
  const kind = params.k;
  const token = typeof params.t === "string" ? params.t : "";
  const done = params.done === "1";

  const valid = Boolean(userId) && isKind(kind) && token === unsubscribeToken(userId, kind);

  // From an organiser's announcement email: keyed on the event and address.
  const announceEvent = typeof params.a === "string" ? params.a : "";
  const announceEmail = typeof params.e === "string" ? params.e : "";
  const announceValid = Boolean(announceEvent && announceEmail) && token === announcementOptOutToken(announceEvent, announceEmail);
  const announceName = announceValid
    ? ((await createAdminClient().from("events").select("name").eq("id", announceEvent).maybeSingle()).data?.name ?? "this event")
    : null;

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-6 py-12">
      <Brand />
      {done ? (
        <>
          <h1 className="display text-[32px]">That&apos;s switched off.</h1>
          <p className="text-[15px] leading-normal text-ink-70">
            You won&apos;t get those emails again. Sign-in codes and anything about your access ending still come
            through, because you need those.
          </p>
        </>
      ) : announceValid ? (
        <>
          <span className="kicker">Email settings</span>
          <h1 className="display text-[32px]">Stop emails about {announceName}?</h1>
          <p className="text-[15px] leading-normal text-ink-70">
            The organiser won&apos;t be able to send you announcements about this event through us. Sign-in codes still
            come through.
          </p>
          <AnnouncementOptOutButton eventId={announceEvent} email={announceEmail} token={token} />
        </>
      ) : valid && isKind(kind) ? (
        <>
          <span className="kicker">Email settings</span>
          <h1 className="display text-[32px]">Turn off {LABELS[kind]}?</h1>
          <p className="text-[15px] leading-normal text-ink-70">
            You can turn them back on any time from your profile.
          </p>
          <UnsubscribeButton userId={userId} kind={kind} token={token} label={`Turn off ${LABELS[kind]}`} />
        </>
      ) : (
        <>
          <h1 className="display text-[32px]">That link has expired.</h1>
          <p className="text-[15px] leading-normal text-ink-70">
            Open your profile to change which emails you get.
          </p>
        </>
      )}
      <Link href="/account" className="btn btn-secondary self-start">
        Your profile
      </Link>
    </main>
  );
}

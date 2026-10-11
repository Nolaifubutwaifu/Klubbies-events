import type { Metadata } from "next";
import Link from "next/link";
import { NoticePage } from "@/components/NoticePage";
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

  const profile = (
    <Link href="/account" className="btn btn-secondary no-underline">
      All email settings
    </Link>
  );

  if (done) {
    return (
      <NoticePage badge="ok" title="That's switched off." actions={profile}>
        <p>
          You won&apos;t get those emails again. Sign-in codes and anything about your access ending still come through,
          because you need those.
        </p>
      </NoticePage>
    );
  }
  if (announceValid) {
    return (
      <NoticePage
        badge="info"
        eyebrow="Email settings"
        title={`Stop emails about ${announceName}?`}
        actions={
          <>
            <AnnouncementOptOutButton eventId={announceEvent} email={announceEmail} token={token} />
            {profile}
          </>
        }
      >
        <p>
          The organiser won&apos;t be able to send you announcements about this event through us. Sign-in codes still come
          through.
        </p>
      </NoticePage>
    );
  }
  if (valid && isKind(kind)) {
    return (
      <NoticePage
        badge="info"
        eyebrow="Email settings"
        title={`Turn off ${LABELS[kind]}?`}
        actions={
          <>
            <UnsubscribeButton userId={userId} kind={kind} token={token} label={`Turn off ${LABELS[kind]}`} />
            {profile}
          </>
        }
      >
        <p>You&apos;ll still get sign-in codes, and you can turn them back on any time from your profile.</p>
      </NoticePage>
    );
  }
  return (
    <NoticePage badge="warn" title="That link has expired." actions={profile}>
      <p>Open your profile to change which emails you get.</p>
    </NoticePage>
  );
}

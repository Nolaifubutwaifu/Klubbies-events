"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendAnnouncementAction } from "@/app/(app)/admin/announcement-actions";
import { Dialog } from "@/components/Dialog";

/**
 * The announcement email: edit the subject and message, and (paid sizes) we
 * send it to every guest with the organiser's name on it. On Free the whole
 * box is greyed out and can't be typed in.
 */
export function AnnouncementComposer({
  eventId,
  handle,
  initialSubject,
  initialBody,
  canSend,
  inApp,
  recipientCount,
  sendsLeft,
  sent,
  planName = null,
  free,
}: {
  eventId: string;
  handle: string;
  initialSubject: string;
  initialBody: string;
  canSend: boolean;
  inApp: boolean;
  recipientCount: number;
  sendsLeft: number;
  sent: { subject: string; recipient_count: number; sent_at: string; when: string }[];
  planName?: string | null;
  /** On the Free size: says so instead of explaining. */
  free: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const people = `${recipientCount.toLocaleString("en-AU")} ${recipientCount === 1 ? "person" : "people"}`;

  return (
    <section className="flex min-w-0 flex-[2_1_440px] flex-col gap-4 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5" aria-labelledby="announcement">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <h2 id="announcement" className="text-[17px] font-semibold">
            Announcement email
          </h2>
          <span className="text-[14px] text-[color:var(--kb-ink-2)]">
            {canSend ? (
              "We send it from Klubbies Events with your name on it."
            ) : free ? (
              <>
                Not included in free plan
                {inApp ? null : (
                  <>
                    {" "}
                    · <Link href={`/admin/${handle}/billing`}>See sizes</Link>
                  </>
                )}
              </>
            ) : (
              "Available once the event is active"
            )}
          </span>
        </span>
        {canSend && planName ? <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">Included on {planName}</span> : null}
      </div>

      <fieldset disabled={!canSend} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:pointer-events-none disabled:select-none disabled:opacity-45">
        <label className="field">
          Subject
          <input className="input" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="field">
          Message
          <textarea className="input min-h-[200px] leading-relaxed" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
          {canSend ? <span className="kb-help font-normal">A Get my photos button with your event link is added below your message.</span> : null}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!canSend || pending || sendsLeft <= 0 || recipientCount === 0}
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12l16-8-6 16-2-7z" />
            </svg>
            Send via Klubbies
          </button>
        </div>
      </fieldset>

      {canSend ? (
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          {recipientCount === 0
            ? "Nobody to send it to yet: add a guest list or share the link first."
            : `Goes to everyone on the guest list and everyone who joined, ${people} now. Replies come to you. ${sendsLeft} of 3 sends left for this event.`}
        </p>
      ) : null}

      {result ? (
        <p className={result.ok ? "m-0 text-[14px] font-medium text-[#1f6b3a]" : "kb-error m-0"} role="status">
          {result.text}
        </p>
      ) : null}

      {sent.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 border-t border-[color:var(--kb-line)] p-0 pt-3 text-[14px] text-[color:var(--kb-ink-2)]">
          {sent.map((item) => (
            <li key={item.sent_at}>
              Sent {item.when} to {item.recipient_count.toLocaleString("en-AU")}: {item.subject}
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Send to ${people}?`}>
        <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
          &ldquo;{subject}&rdquo; goes out now, with your name on it and a button to the gallery. It can&apos;t be called
          back.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
            Not yet
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await sendAnnouncementAction(eventId, subject, body).catch(() => ({ error: "Couldn't send it. Try again." }));
                setConfirming(false);
                setResult(res.error ? { text: res.error } : { ok: true, text: ("message" in res && res.message) || "Sent" });
              })
            }
          >
            {pending ? "Sending…" : "Send now"}
          </button>
        </div>
      </Dialog>
    </section>
  );
}

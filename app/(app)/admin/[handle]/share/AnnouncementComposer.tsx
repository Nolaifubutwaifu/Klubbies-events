"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendAnnouncementAction } from "@/app/(app)/admin/announcement-actions";
import { CopyButton } from "@/components/CopyButton";
import { Dialog } from "@/components/Dialog";

/**
 * The announcement email: edit the subject and message, then copy it into
 * your own email, or (paid sizes) have us send it to every guest for you.
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
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const people = `${recipientCount.toLocaleString("en-AU")} ${recipientCount === 1 ? "person" : "people"}`;

  return (
    <section className="soft-card flex flex-col gap-4 p-5" aria-labelledby="announcement">
      <div className="flex flex-col gap-1">
        <h2 id="announcement" className="text-[16px] font-semibold">
          Announcement email
        </h2>
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          Edit it to sound like you. {canSend ? "Send it to your guests from here, or copy it into your own email." : "Copy it into your own email or ticketing tool."}
        </p>
      </div>

      <label className="field">
        Subject
        <input className="input" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="field">
        Message
        <textarea className="input min-h-[240px] leading-relaxed" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {canSend ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || sendsLeft <= 0 || recipientCount === 0}
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
          >
            Send to {people}
          </button>
        ) : null}
        <CopyButton value={subject} label="Copy subject" className="btn btn-secondary" />
        <CopyButton value={body} label="Copy message" className="btn btn-secondary" />
      </div>

      {canSend ? (
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          {recipientCount === 0
            ? "Nobody to send it to yet: add a guest list or share the link first."
            : `Goes to everyone on the guest list and everyone who joined, ${people} now. Replies come to you. ${sendsLeft} of 3 sends left for this event.`}
        </p>
      ) : (
        <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
          {inApp ? (
            "Sending it for you isn't included in this event's size."
          ) : (
            <>
              We can send it to every guest for you on the paid sizes. <Link href={`/admin/${handle}/billing`}>See sizes</Link>
            </>
          )}
        </p>
      )}

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

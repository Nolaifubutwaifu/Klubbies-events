"use client";

import { useEffect, useState, useTransition } from "react";
import {
  disableClubFacesAction,
  enableClubFacesAction,
  faceProgressAction,
  runFaceJobsAction,
} from "@/app/(app)/face-actions";
import { CLUB_NOTICE } from "@/lib/faces/copy";

type Props = {
  clubId: string;
  clubName: string;
  configured: boolean;
  enabled: boolean;
  enrolledCount: number;
  backfill: { total: number; remaining: number; status: string };
};

/**
 * Not a switch. Turning this on creates a faceprint for everyone in the
 * club's photos, including people who never opted in, so the committee reads
 * what that means and ticks a box before anything happens.
 */
export function FaceRecognition({ clubId, clubName, configured, enabled, enrolledCount, backfill }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  // The server's numbers are a snapshot from render; this keeps them moving.
  const [live, setLive] = useState(backfill);
  const [faces, setFaces] = useState<number | null>(null);
  const working = live.remaining > 0 || live.status === "queued" || live.status === "running";

  // Poll while there is work left, and stop the moment there is not. A first
  // backfill runs for minutes, and a page showing a frozen number for that
  // long reads as broken even when everything is fine. `working` is in the
  // dependencies, so finishing tears the interval down on its own.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      const next = await faceProgressAction(clubId);
      if (cancelled || next.error) return;
      setLive({ total: next.total, remaining: next.remaining, status: next.status });
      setFaces(next.faces);
    };
    void tick();
    if (!working) return;
    const timer = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [clubId, enabled, working]);

  if (!configured) {
    return (
      <div className="soft-card flex flex-col gap-2 p-5">
        <span className="text-[14px] font-bold">Find yourself in photos</span>
        <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
          Not available on this deployment yet. It needs AWS credentials set on the server.
        </p>
      </div>
    );
  }

  if (enabled) {
    const done = Math.max(0, live.total - live.remaining);
    return (
      <div className="soft-card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[14px] font-bold">Find yourself in photos</span>
          <span className="soft-chip">On</span>
        </div>
        <p className="m-0 text-[14px] text-[color:var(--ink-70)]">
          {enrolledCount === 0
            ? "No members have enrolled yet. They see the invitation on the club page."
            : `${enrolledCount.toLocaleString("en-AU")} ${enrolledCount === 1 ? "member has" : "members have"} enrolled. Each of them sees only their own photos.`}
        </p>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="flex items-center gap-2">
              {working ? (
                <>
                  {/* A moving dot is the cheapest possible "yes, still going". */}
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  Looking through your photos
                </>
              ) : (
                "Library up to date"
              )}
            </span>
            <span className="text-[color:var(--ink-55)]">
              {done.toLocaleString("en-AU")} of {live.total.toLocaleString("en-AU")}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${live.total ? Math.round((done / live.total) * 100) : 100}%` }}
            />
          </div>
          <span className="text-[14px] text-[color:var(--ink-55)]">
            {faces === null
              ? "\u00a0"
              : working
                ? `${faces.toLocaleString("en-AU")} faces found so far. You can leave this page; it keeps going.`
                : `${faces.toLocaleString("en-AU")} faces found. Members who enrol are matched against these.`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* "Run now" only when there is something to run: the cron and the
              upload kick handle the steady state. */}
          {working ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await runFaceJobsAction(clubId);
                  setMessage(res.error ?? res.message ?? "");
                })
              }
            >
              {pending ? "Running…" : "Speed it up"}
            </button>
          ) : null}
          {confirmingOff ? (
            <>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await disableClubFacesAction(clubId);
                    setMessage(res.error ?? res.message ?? "");
                    setConfirmingOff(false);
                  })
                }
              >
                Yes, delete every faceprint
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingOff(false)}>
                Keep it on
              </button>
            </>
          ) : (
            <button type="button" className="kb-link kb-link-quiet" onClick={() => setConfirmingOff(true)}>
              Turn face recognition off
            </button>
          )}
        </div>
        {confirmingOff ? (
          <p className="kb-error m-0">
            This deletes every faceprint for {clubName}, every enrolment selfie and every match. Your photos are not
            touched. There is no undo.
          </p>
        ) : null}
        {message ? <p className="m-0 text-[14px] text-[color:var(--ink-55)]">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="soft-card flex flex-col gap-3 p-5">
      <span className="text-[15px] font-bold">{CLUB_NOTICE.title(clubName)}</span>
      <p className="m-0 text-[14px] text-[color:var(--ink-70)]">{CLUB_NOTICE.lead}</p>
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-normal text-[color:var(--ink-70)]">
        {CLUB_NOTICE.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5"
        />
        <span>{CLUB_NOTICE.tickbox(clubName)}</span>
      </label>
      <button
        type="button"
        className="btn btn-secondary self-start"
        disabled={!accepted || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await enableClubFacesAction(clubId, accepted);
            setMessage(res.error ?? res.message ?? "");
          })
        }
      >
        {pending ? "Setting it up…" : "Turn on face recognition"}
      </button>
      {message ? <p className="m-0 text-[14px] text-[color:var(--ink-55)]">{message}</p> : null}
    </div>
  );
}

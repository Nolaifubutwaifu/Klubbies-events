import { includedGuests } from "@/lib/billing/plans";

function Meter({ label, used, limit, note }: { label: string; used: number; limit: number | null; note?: string }) {
  const share = limit ? Math.min(1, used / limit) : 0;
  const tone = limit && used >= limit ? "var(--kb-ink)" : "var(--kb-ember)";
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-[color:var(--kb-ink-2)]">
          {used.toLocaleString("en-AU")}
          {limit ? ` of ${limit.toLocaleString("en-AU")}` : ""}
        </span>
      </span>
      {limit ? (
        <span
          className="block h-2 overflow-hidden rounded-full bg-[color:var(--kb-sand)]"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
        >
          <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: tone }} />
        </span>
      ) : null}
      {note ? <span className="text-[14px] text-[color:var(--kb-ink-3)]">{note}</span> : null}
    </div>
  );
}

/**
 * "Guests 132 of 150" and "Photos 1,210 of 1,500" (pricing handoff §5.8).
 * Videos count as photo equivalents; the bin is left out. No prices here, so
 * it is safe inside the iPhone app.
 */
export function PlanMeters({
  guestsJoined,
  guestLimit,
  guestsPaused,
  unitsUsed,
  photoLimit,
}: {
  guestsJoined: number;
  guestLimit: number | null;
  guestsPaused: number;
  unitsUsed: number;
  photoLimit: number | null;
}) {
  const guestNote = [
    guestLimit ? `Up to ${includedGuests(guestLimit).toLocaleString("en-AU")} can join (10% over is included)` : "No guest limit",
    guestsPaused ? `${guestsPaused} paused` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-wrap gap-6">
      <Meter label="Guests" used={guestsJoined} limit={guestLimit} note={guestNote} />
      <Meter
        label="Photos"
        used={unitsUsed}
        limit={photoLimit}
        note={photoLimit ? "Each started minute of video counts as 10" : "No photo limit"}
      />
    </div>
  );
}

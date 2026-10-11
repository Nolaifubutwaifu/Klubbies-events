import Link from "next/link";
import { facesConfigured } from "@/lib/faces/client";
import { createClient } from "@/lib/supabase/server";
import type { MyEvent } from "@/lib/auth/session";

/**
 * Face recognition on the account page, per event, because consent is per event
 * — collections are, so a member in three events made three decisions and has
 * to be able to see and undo each one in the same place.
 *
 * The row is permanent, unlike the banner on the event page. Somewhere that is
 * always there is the difference between a setting and a nag.
 */
export async function FaceRow({ events }: { events: MyEvent[] }) {
  // Same rule as the event page: a deployment with no AWS credentials does
  // not advertise a feature it cannot run.
  if (events.length === 0 || !facesConfigured()) return null;
  const supabase = await createClient();
  const eventIds = events.map((event) => event.eventId);

  const [{ data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("event_face_settings").select("event_id, enabled").in("event_id", eventIds),
    supabase.from("member_face_profiles").select("event_id, status").in("event_id", eventIds),
  ]);

  const enabled = new Set((settings ?? []).filter((row) => row.enabled).map((row) => row.event_id));
  const statusByEvent = new Map((profiles ?? []).map((row) => [row.event_id, row.status]));
  const rows = events.filter((event) => enabled.has(event.eventId));
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="g-faces">
      <h2 id="g-faces" className="kb-group-title">
        Face search
      </h2>
      <div className="kb-group">
        {rows.map((event) => {
          const status = statusByEvent.get(event.eventId);
          return (
            <Link key={event.membershipId} href={`/e/${event.handle}/me`} className="kb-row">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-3)]" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{event.name}</span>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                  {status === "ready"
                    ? "Selfie added. Only you see your matches."
                    : status === "pending"
                      ? "Setting up."
                      : status === "failed"
                        ? "Your selfie could not be read."
                        : "No face data"}
                </span>
              </span>
              <span className="text-[15px] font-medium text-[color:var(--kb-ember)]">{status === "ready" ? "Manage" : "Set up"}</span>
            </Link>
          );
        })}
      </div>
      <p className="m-0 px-1 pt-2 text-[14px] leading-normal text-[color:var(--kb-ink-3)]">
        Turning it off deletes your selfie, your faceprint and every match for that event within 24 hours.
      </p>
    </section>
  );
}

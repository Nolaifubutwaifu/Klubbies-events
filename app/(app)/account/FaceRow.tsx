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
    <>
      <h2 className="mt-2 text-[16px] font-semibold">Face search</h2>
      <div className="soft-card flex flex-col">
        {rows.map((event, index) => {
          const status = statusByEvent.get(event.eventId);
          return (
            <div
              key={event.membershipId}
              className={`flex flex-wrap items-center gap-3 p-4 ${
                index > 0 ? "border-t border-[color:var(--kb-line)]" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{event.name}</span>
                <span className="block text-[14px] text-[color:var(--ink-70)]">
                  {status === "ready"
                    ? "On. Only you see your matches."
                    : status === "pending"
                      ? "Setting up."
                      : status === "failed"
                        ? "Your selfie could not be read."
                        : "Off. Add a selfie to find yourself in photos."}
                </span>
              </span>
              <Link
                href={`/e/${event.handle}/me`}
                className="btn btn-sm btn-secondary no-underline"
              >
                {status === "ready" ? "Manage" : "Set it up"}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="m-0 text-[14px] leading-normal text-[color:var(--ink-70)]">
        Turning it off deletes your selfie, your faceprint and every match for that event within 24 hours.
      </p>
    </>
  );
}

import Link from "next/link";
import { facesConfigured } from "@/lib/faces/client";
import { createClient } from "@/lib/supabase/server";
import type { MyClub } from "@/lib/auth/session";

/**
 * Face recognition on the account page, per club, because consent is per club
 * — collections are, so a member in three clubs made three decisions and has
 * to be able to see and undo each one in the same place.
 *
 * The row is permanent, unlike the banner on the club page. Somewhere that is
 * always there is the difference between a setting and a nag.
 */
export async function FaceRow({ clubs }: { clubs: MyClub[] }) {
  // Same rule as the club page: a deployment with no AWS credentials does
  // not advertise a feature it cannot run.
  if (clubs.length === 0 || !facesConfigured()) return null;
  const supabase = await createClient();
  const clubIds = clubs.map((club) => club.clubId);

  const [{ data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("club_face_settings").select("club_id, enabled").in("club_id", clubIds),
    supabase.from("member_face_profiles").select("club_id, status").in("club_id", clubIds),
  ]);

  const enabled = new Set((settings ?? []).filter((row) => row.enabled).map((row) => row.club_id));
  const statusByClub = new Map((profiles ?? []).map((row) => [row.club_id, row.status]));
  const rows = clubs.filter((club) => enabled.has(club.clubId));
  if (rows.length === 0) return null;

  return (
    <>
      <h2 className="soft-display mt-2 text-[18px]">Face recognition</h2>
      <div className="soft-card flex flex-col">
        {rows.map((club, index) => {
          const status = statusByClub.get(club.clubId);
          return (
            <div
              key={club.membershipId}
              className={`flex flex-wrap items-center gap-3 p-4 ${
                index > 0 ? "border-t border-[color-mix(in_srgb,var(--color-text)_7%,transparent)]" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold">{club.name}</span>
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
                href={`/c/${club.handle}/me`}
                className="soft-btn soft-btn-tonal !min-h-[36px] !px-3.5 !text-[14px] no-underline"
              >
                {status === "ready" ? "Manage" : "Set it up"}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="m-0 text-[14px] leading-normal text-[color:var(--ink-70)]">
        Turning it off deletes your selfie, your faceprint and every match for that club within 24 hours.
      </p>
    </>
  );
}

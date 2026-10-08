import "server-only";
import { cache } from "react";
import { isTier, planName, TIERS } from "@/lib/billing/plans";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type SetupStep = {
  key: "details" | "access" | "size" | "brand" | "guests" | "album" | "photographer" | "share";
  title: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
};

export type SetupState = {
  /** Details, who can get in, and size: until these are done the organiser sees only the setup screens. */
  required: SetupStep[];
  /** What makes the event good, in the order it's worth doing. */
  recommended: SetupStep[];
  requiredDone: boolean;
  /** The first step not done yet, required ones first. */
  next: SetupStep | null;
  doneCount: number;
  total: number;
};

/**
 * One reading of how far an event's setup has got, shared by the organiser
 * layout (which hides the full menu until the required steps are done), the
 * setup screen and the overview's Next step card. It reads the event's real
 * state, so leaving and coming back always picks up where things are.
 */
export const setupState = cache(async (event: EventRow, inApp: boolean): Promise<SetupState> => {
  const supabase = await createClient();
  const handle = event.handle;
  const [{ count: onList }, { count: joined }, { count: albums }, { count: links }, { count: photographerAccounts }] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("event_id", event.id).in("status", ["pending", "active"]),
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "active")
      .not("user_id", "is", null)
      .neq("role", "event_admin"),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase.from("album_guest_links").select("id", { count: "exact", head: true }).eq("event_id", event.id).is("revoked_at", null),
    supabase
      .from("memberships")
      .select("id, event_roles!inner(key)", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("event_roles.key", "photographer"),
  ]);

  const guestList = event.access_mode === "guest_list";
  const photographers = (links ?? 0) + (photographerAccounts ?? 0);
  const attendees = joined ?? 0;
  // Free is a real choice; saying how many guests to expect is what makes it one.
  const sizeDone = event.plan !== "free" || Boolean(event.expected_guests);

  const required: SetupStep[] = [
    {
      key: "details",
      title: "Event details",
      hint: event.starts_on ? "Name, dates and venue are set" : "Add the date and venue attendees will see",
      done: Boolean(event.starts_on),
      href: `/admin/${handle}/settings`,
      cta: event.starts_on ? "Edit" : "Add details",
    },
    {
      key: "access",
      title: "Who can get in",
      hint: guestList ? "Guest list only" : "Anyone with the event link who confirms their email",
      done: true,
      href: `/admin/${handle}/settings#access`,
      cta: "Change",
    },
    {
      key: "size",
      title: "Event size",
      hint: isTier(event.plan)
        ? `${planName(event.plan)}: up to ${TIERS[event.plan].guests.toLocaleString("en-AU")} guests and ${TIERS[event.plan].photos.toLocaleString("en-AU")} photos`
        : `${planName(event.plan)}`,
      done: sizeDone,
      href: `/admin/${handle}/setup`,
      cta: sizeDone ? (inApp ? "View" : "Change") : "Choose",
    },
  ];

  const recommended: SetupStep[] = [
    {
      key: "brand",
      title: "Add your logo and colour",
      hint: event.logo_path ? "Your logo is on every attendee screen" : "Your logo and colour on the event's pages",
      done: Boolean(event.logo_path),
      href: `/admin/${handle}/settings#brand`,
      cta: event.logo_path ? "Change" : "Add your logo",
    },
    ...(guestList
      ? [
          {
            key: "guests" as const,
            title: "Import the guest list",
            hint: (onList ?? 0) > 1 ? `${(onList ?? 0).toLocaleString("en-AU")} on the list` : "Only people on your list can get in",
            done: (onList ?? 0) > 1,
            href: `/admin/${handle}/attendees`,
            cta: (onList ?? 0) > 1 ? "View list" : "Import",
          },
        ]
      : []),
    {
      key: "album",
      title: "Create your first album",
      hint: (albums ?? 0) > 0 ? plural(albums ?? 0, "album") : "One per part of the event: keynote, drinks, headshots",
      done: (albums ?? 0) > 0,
      href: `/admin/${handle}/upload`,
      cta: "New album",
    },
    {
      key: "photographer",
      title: "Add your photographers",
      hint: photographers > 0 ? `${plural(photographers, "photographer")} can upload` : "Each gets their own upload link. No account needed",
      done: photographers > 0,
      href: `/admin/${handle}/photographers`,
      cta: photographers > 0 ? "Manage" : "Add photographer",
    },
    {
      key: "share",
      title: "Share the link and QR code",
      hint: attendees > 0 ? `${plural(attendees, "attendee")} joined` : "For the closing slide, table cards and the follow-up email",
      done: attendees > 0,
      href: `/admin/${handle}/share`,
      cta: "Open share kit",
    },
  ];

  const all = [...required, ...recommended];
  const requiredDone = required.every((step) => step.done);
  return {
    required,
    recommended,
    requiredDone,
    next: all.find((step) => !step.done) ?? null,
    doneCount: all.filter((step) => step.done).length,
    total: all.length,
  };
});

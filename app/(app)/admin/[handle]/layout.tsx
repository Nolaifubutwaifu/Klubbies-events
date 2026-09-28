import { AdminNav } from "@/components/AdminNav";
import { AppHeader } from "@/components/AppHeader";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { accessHasEnded } from "@/lib/auth/session";
import { TIERS } from "@/lib/billing/plans";
import { BILLING_LABEL, canWrite, type BillingStatus } from "@/lib/billing/status";
import { PRICE } from "@/lib/copy/site";
import { eventAddress } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { eventToneStyle } from "@/lib/theme";

export default async function AdminLayout(props: LayoutProps<"/admin/[handle]">) {
  const { handle } = await props.params;
  const ctx = await requireAdminContext(handle);
  const supabase = await createClient();
  const { event } = ctx;

  // The rail carries live counts, so it doubles as the state of the event.
  const [albums, attendees, photographers, removals, published] = await Promise.all([
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .in("status", ["pending", "active"]),
    supabase
      .from("album_guest_links")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("media_removal_requests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "open"),
    supabase.from("albums").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "published"),
  ]);

  const logoUrl = event.logo_path ? ((await signLogoMarks(supabase, [event.logo_path])).get(event.logo_path) ?? null) : null;

  const billing = event.billing_status as BillingStatus;
  const writable = canWrite(event);
  const plan =
    event.plan === "free"
      ? { line: "Free", hint: `Up to ${TIERS.free.guests} guests and ${TIERS.free.photos} photos` }
      : billing === "comped"
      ? { line: "Complimentary", hint: "Nothing to pay for this event" }
      : writable
        ? { line: PRICE.line, hint: event.paid_at ? `Paid ${formatDate(event.paid_at)}` : BILLING_LABEL[billing] }
        : { line: BILLING_LABEL[billing], hint: "Activate to upload" };

  const status: { label: string; tone: "live" | "quiet" | "attention" } = !writable
    ? { label: "Not activated", tone: "attention" }
    : accessHasEnded(event)
      ? { label: `Closed ${formatDate(event.access_ends_at)}`, tone: "quiet" }
      : (published.count ?? 0) > 0
        ? { label: "Live", tone: "live" }
        : { label: "Ready, nothing published", tone: "quiet" };

  return (
    <div className="flex flex-1 flex-col" style={eventToneStyle(event.accent_colour)}>
      <AppHeader ctx={ctx} area="organiser" />
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-2 px-4 pt-4 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:pt-6">
        <AdminNav
          handle={handle}
          eventName={event.name}
          eventAddress={eventAddress(handle)}
          accentColour={event.accent_colour}
          logoUrl={logoUrl}
          status={status}
          counts={{
            albums: albums.count ?? 0,
            attendees: attendees.count ?? 0,
            photographers: photographers.count ?? 0,
            removals: removals.count ?? 0,
          }}
          plan={plan}
        />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </div>
  );
}

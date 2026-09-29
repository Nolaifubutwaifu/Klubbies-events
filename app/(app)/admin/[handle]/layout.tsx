import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { AppHeader } from "@/components/AppHeader";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { accessHasEnded } from "@/lib/auth/session";
import { isTier, planName, retentionNotice, TIERS } from "@/lib/billing/plans";
import { BILLING_LABEL, canWrite, type BillingStatus } from "@/lib/billing/status";
import { eventAddress } from "@/lib/env";
import { setupState } from "@/lib/events/setup";
import { formatDate, formatLongDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { isNativeAppRequest } from "@/lib/native-app-server";
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

  const retention = retentionNotice(event);
  const inApp = await isNativeAppRequest();
  const billing = event.billing_status as BillingStatus;
  const writable = canWrite(event);
  const plan = isTier(event.plan)
    ? {
        line: `${planName(event.plan)}${event.plan_rate === "club" ? " · club rate" : ""}`,
        hint: `Up to ${TIERS[event.plan].guests.toLocaleString("en-AU")} guests and ${TIERS[event.plan].photos.toLocaleString("en-AU")} photos`,
      }
    : billing === "comped"
      ? { line: "Complimentary", hint: "Nothing to pay for this event" }
      : writable
        ? { line: planName(event.plan), hint: event.paid_at ? `Paid ${formatDate(event.paid_at)}` : BILLING_LABEL[billing] }
        : { line: BILLING_LABEL[billing], hint: "Activate to upload" };

  const status: { label: string; tone: "live" | "quiet" | "attention" } = !writable
    ? { label: "Not activated", tone: "attention" }
    : accessHasEnded(event)
      ? { label: `Closed ${formatDate(event.access_ends_at)}`, tone: "quiet" }
      : (published.count ?? 0) > 0
        ? { label: "Live", tone: "live" }
        : { label: "Ready, nothing published", tone: "quiet" };

  const setup = await setupState(event, inApp);

  // Until details, who can get in and size are done, the organiser sees only
  // the setup screens: no menu, nothing to wander off to (decision 102).
  if (!setup.requiredDone) {
    return (
      <div className="kb-branded flex flex-1 flex-col" style={eventToneStyle(event.accent_colour)}>
        <AppHeader ctx={ctx} area="organiser" />
        <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 pt-6 sm:px-6">{props.children}</div>
      </div>
    );
  }

  const nextStep = setup.recommended.find((step) => !step.done) ?? null;

  return (
    <div className="kb-branded flex flex-1 flex-col" style={eventToneStyle(event.accent_colour)}>
      <AppHeader ctx={ctx} area="organiser" />
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-3 px-4 pt-4 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:pt-6">
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
          next={
            nextStep
              ? {
                  title: nextStep.title,
                  href: nextStep.href,
                  done: setup.recommended.filter((step) => step.done).length,
                  total: setup.recommended.length,
                }
              : null
          }
        />
        <div className="min-w-0 flex-1">
          {retention ? (
            <div className="kb-info mb-4 flex-wrap items-center justify-between" role="status">
              {retention.kind === "deleted" ? (
                <span>Photos from this event were deleted on {formatLongDate(retention.on)}, 12 months after the event.</span>
              ) : (
                <>
                  <span>
                    Photos from this event will be deleted on {formatLongDate(retention.on)}. Download what you want to keep.
                  </span>
                  <Link href={`/admin/${handle}/billing#keep`} className="font-medium">
                    {inApp ? "Details" : "Keep another year"}
                  </Link>
                </>
              )}
            </div>
          ) : null}
          {props.children}
        </div>
      </div>
    </div>
  );
}

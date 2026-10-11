import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SubmitButton } from "@/components/forms";
import { PlanMeters } from "@/components/PlanMeters";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { CLUB_CODES } from "@/lib/billing/club-codes";
import { isTier, KEEP_YEAR_AUD, overflowWindow, planName, suggestedTier, TIERS, tierOffers } from "@/lib/billing/plans";
import { stripeConfigured, syncReturnedSession } from "@/lib/billing/stripe";
import { getPlanUsage } from "@/lib/billing/usage";
import { formatDateTime, formatLongDate } from "@/lib/format";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { createClient } from "@/lib/supabase/server";
import { devActivateAction, openBillingPortalAction, startCheckoutAction, startKeepYearAction } from "../../billing-actions";
import { ClubCodeForm, ExpectedGuestsForm } from "./BillingForms";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage(props: PageProps<"/admin/[handle]/billing">) {
  const { handle } = await props.params;
  const search = await props.searchParams;
  let ctx = await requireAdminContext(handle);
  const configured = stripeConfigured();

  let justPaid = false;
  if (configured && typeof search.session_id === "string") {
    justPaid = await syncReturnedSession(search.session_id, ctx.event.id).catch((error: unknown) => {
      console.error("session sync failed", error);
      return false;
    });
    // The plan may have just changed: read the event again.
    if (justPaid) ctx = await requireAdminContext(handle);
  }
  const { event } = ctx;

  const supabase = await createClient();
  const [usage, { data: purchases }] = await Promise.all([
    getPlanUsage(event.id),
    supabase
      .from("event_purchases")
      .select("id, kind, from_plan, to_plan, late, amount_cents, created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
  ]);

  const offers = tierOffers(event);
  const suggestion = suggestedTier(event.expected_guests);
  const devActivate = !configured && process.env.NODE_ENV !== "production";
  // Apple doesn't allow an iPhone app to sell digital services except through
  // in-app purchase, or to point people at another way to pay. So inside the
  // app this page reports the event's plan and offers no payment controls.
  const inApp = isNativeAppUserAgent((await headers()).get("user-agent"));
  const rateLabel = event.plan_rate === "club" || (!event.plan_rate && event.club_code) ? "Club rate" : null;

  const { windowEnds, windowOpen } = overflowWindow(event);

  return (
    <main className="flex max-w-[920px] flex-col gap-6">
      <PageTitle kicker={event.name} title="Plan and billing">
        One payment for this event. No subscription.
      </PageTitle>

      {search.canceled ? <div className="notice">Checkout was cancelled. Nothing was charged.</div> : null}
      {search.error === "checkout" ? <div className="notice">We couldn&apos;t open checkout. Try again in a moment.</div> : null}
      {search.error === "portal" ? <div className="notice">We couldn&apos;t open your receipts. Try again in a moment.</div> : null}
      {justPaid ? (
        <div className="notice" role="status">
          {purchases?.[0]?.kind === "keep_year" && event.photos_delete_at ? (
            <>Paid. Photos from {event.name} are now kept until {formatLongDate(event.photos_delete_at)}.</>
          ) : (
            <>
              Paid. {event.name} is now {planName(event.plan)}.{" "}
              <Link href={`/admin/${handle}/setup`}>Continue setting up</Link>
            </>
          )}
        </div>
      ) : null}

      <section aria-labelledby="current" className="flex flex-wrap items-start gap-8 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-6">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
          <span className="text-[14px] text-[color:var(--kb-ink-3)]">Current size</span>
          <h2 id="current" className="flex flex-wrap items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em]">
            {planName(event.plan)}
            {event.billing_status === "comped" ? (
              <span className="kb-chip bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]">Complimentary</span>
            ) : event.paid_at ? (
              <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">Paid</span>
            ) : event.plan === "free" ? (
              <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">Free</span>
            ) : null}
            {rateLabel ? <span className="kb-chip bg-[color:var(--kb-sand)] text-[color:var(--kb-ink-2)]">{rateLabel}</span> : null}
          </h2>
          {event.paid_at ? (
            <p className="text-[15px] text-[color:var(--kb-ink-2)]">
              {!inApp && purchases?.find((p) => p.kind !== "keep_year") ? (
                <>
                  <span className="mono">A${((purchases?.find((p) => p.kind !== "keep_year")?.amount_cents ?? 0) / 100).toFixed(0)}</span> paid on{" "}
                </>
              ) : (
                "Paid "
              )}
              {formatLongDate(event.paid_at)}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 flex-[2_1_360px]">
        {usage ? (
          <PlanMeters
            guestsJoined={usage.guestsJoined}
            guestLimit={usage.guestLimit}
            guestsPaused={usage.guestsPaused}
            unitsUsed={usage.unitsUsed}
            photoLimit={usage.photoLimit}
          />
        ) : null}
        {windowOpen && windowEnds && event.guest_limit ? (
          <div className="kb-info flex-col" role="status">
            <strong>This event is over its guest limit.</strong>
            <span>
              Guests can keep joining for now, until {formatDateTime(windowEnds)} at the latest.
              {inApp ? "" : " Choose a bigger size before then to keep them all."}
            </span>
          </div>
        ) : null}
        {usage && usage.guestsPaused > 0 ? (
          <div className="kb-info flex-col" role="status">
            <strong>
              {usage.guestsPaused === 1 ? "1 guest is paused." : `${usage.guestsPaused} guests are paused.`}
            </strong>
            <span>
              They joined after the event filled up and can&apos;t see photos yet.
              {inApp ? "" : " Choosing a bigger size lets them all in straight away."}
            </span>
          </div>
        ) : null}
        {event.plan === "unlimited" ? (
          <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">This event has no guest or photo limit.</p>
        ) : null}
        </div>
      </section>

      {/* No sizes or prices in the app (Apple 3.1.1), but not a dead end
          either: what the organiser can do from here is make room. */}
      {offers.length && inApp ? (
        <section className="kb-info flex-col">
          <strong>Making room</strong>
          <span>
            Videos use the most of the allowance. Remove uploads that didn&apos;t finish and clips you don&apos;t need from
            each album; removed files stop counting straight away. The event&apos;s size can&apos;t be changed in the iPhone app.
          </span>
          <Link href={`/admin/${event.handle}/albums`} className="kb-link self-start">
            Go to albums
          </Link>
        </section>
      ) : null}

      {offers.length && !inApp ? (
        <section className="flex flex-col gap-4" aria-labelledby="sizes">
          <div className="flex flex-col gap-1">
            <h2 id="sizes" className="text-[18px] font-semibold">
              {event.plan === "free" ? "Choose a size" : "Need a bigger size?"}
            </h2>
            {offers[0]?.kind === "upgrade" ? (
              <p className="text-[15px] text-[color:var(--kb-ink-2)]">You&apos;ve already paid for {planName(event.plan)}, so you only pay the extra.</p>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-[10px] border border-[color:var(--kb-line)] bg-white">
            {isTier(event.plan) ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-[color:var(--kb-cream)] px-5 py-4">
                <span className="flex items-center gap-2.5 font-semibold">
                  {TIERS[event.plan].name}
                  <span className="kb-chip bg-[color:var(--kb-brand-tint)] text-[color:var(--kb-brand-deep)]">Your size</span>
                </span>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                  {TIERS[event.plan].guests.toLocaleString("en-AU")} guests · {TIERS[event.plan].photos.toLocaleString("en-AU")} photos
                </span>
              </div>
            ) : null}
            {offers.map((offer, index) => {
              const tier = TIERS[offer.to];
              const fits = suggestion === offer.to;
              const primary = suggestion ? fits : index === 0;
              return (
                <div key={offer.to} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--kb-sand)] px-5 py-4">
                  <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                    <span className="flex flex-wrap items-center gap-2.5 font-semibold">
                      {tier.name}
                      <span className="mono font-medium">{offer.kind === "upgrade" ? "+" : ""}A${offer.amount}</span>
                      {fits ? <span className="kb-chip bg-[color:var(--kb-ok-tint)] text-[color:var(--kb-ok)]">Fits your guests</span> : null}
                    </span>
                    <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                      {tier.guests.toLocaleString("en-AU")} guests · {tier.photos.toLocaleString("en-AU")} photos
                      {offer.late ? " · includes the late surcharge" : ""}
                      {offer.rate === "club" ? " · club rate" : ""}
                    </span>
                  </span>
                  {devActivate ? null : (
                    <form action={startCheckoutAction.bind(null, event.id, offer.to)}>
                      <SubmitButton className={`btn ${primary ? "btn-primary" : "btn-secondary"}`} pendingText="Opening secure checkout…" disabled={!configured}>
                        {offer.kind === "upgrade" ? `Move up to ${tier.name}` : `Choose ${tier.name}`}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
          <ExpectedGuestsForm eventId={event.id} expected={event.expected_guests} />
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
            If more guests turn up than your size allows, they can usually keep joining for a short while, and at some
            point we may pause new guests until you upgrade. Upgrading after that point costs more; the price is shown
            before you pay.
            {offers[0]?.kind === "tier" ? " Have a promotion code? Enter it on the payment page." : ""}
          </p>
          {!event.plan_rate ? <ClubCodeForm eventId={event.id} code={event.club_code} campus={event.club_code ? (CLUB_CODES[event.club_code] ?? null) : null} /> : null}
          {!configured && !devActivate ? (
            <div className="notice">Payments aren&apos;t configured on this deployment yet (STRIPE_SECRET_KEY).</div>
          ) : null}
          <span className="text-[14px] text-[color:var(--kb-ink-3)]">
            Prices are in Australian dollars. Payments go through Stripe, and we never see your card details. See the{" "}
            <Link href="/terms">terms</Link> and <Link href="/refunds">refund policy</Link>.
          </span>
        </section>
      ) : null}

      <section
        id="keep"
        aria-labelledby="keep-heading"
        className="flex scroll-mt-24 flex-wrap items-center gap-4 rounded-[10px] border border-[color:var(--kb-line)] bg-white p-5 sm:p-6"
      >
        <span className="kb-icon-well" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </span>
        {event.photos_deleted_at ? (
          <span className="flex min-w-0 flex-[1_1_320px] flex-col">
            <h2 id="keep-heading" className="text-[17px] font-semibold">
              Photos were deleted on {formatLongDate(event.photos_deleted_at)}
            </h2>
            <span className="text-[14px] text-[color:var(--kb-ink-2)]">12 months after the event, as the terms say.</span>
          </span>
        ) : (
          <>
            <span className="flex min-w-0 flex-[1_1_320px] flex-col">
              <h2 id="keep-heading" className="text-[17px] font-semibold">
                Photos are kept until {formatLongDate(event.photos_delete_at)}
              </h2>
              <span className="text-[14px] text-[color:var(--kb-ink-2)]">
                After that every photo, video and face record is deleted, and nothing can be recovered. We email you 30 and 7
                days before.
                {event.extra_years ? ` Includes ${event.extra_years === 1 ? "a year" : `${event.extra_years} years`} you kept.` : ""}
              </span>
            </span>
            {inApp ? null : (
              <form action={startKeepYearAction.bind(null, event.id)}>
                <SubmitButton className="btn btn-secondary" pendingText="Opening secure checkout…" disabled={!configured}>
                  Keep another year · A${KEEP_YEAR_AUD}
                </SubmitButton>
              </form>
            )}
          </>
        )}
      </section>

      {devActivate && event.plan !== "unlimited" ? (
        <form action={devActivateAction.bind(null, event.id)}>
          <SubmitButton className="btn btn-secondary" pendingText="Activating…">
            Make unlimited without payment (development)
          </SubmitButton>
        </form>
      ) : null}

      {purchases?.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="payments">
          <h2 id="payments" className="text-[16px] font-semibold">
            Payments
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--kb-line)] rounded-[10px] border border-[color:var(--kb-line)] bg-white p-0">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[15px]">
                <span>
                  {p.kind === "keep_year"
                    ? "Keep another year"
                    : p.kind === "upgrade"
                      ? `${planName(p.from_plan ?? "")} to ${planName(p.to_plan ?? "")}`
                      : planName(p.to_plan ?? "")}
                  {p.late ? " (late)" : ""}
                </span>
                <span className="text-[color:var(--kb-ink-2)]">
                  {inApp ? "" : `A$${(p.amount_cents / 100).toFixed(2)} · `}
                  {formatLongDate(p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {event.stripe_customer_id && configured && !inApp ? (
        <form action={openBillingPortalAction.bind(null, event.id)}>
          <SubmitButton className="btn btn-secondary" pendingText="Opening…">
            Receipts and invoices
          </SubmitButton>
        </form>
      ) : null}
    </main>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SubmitButton } from "@/components/forms";
import { PlanMeters } from "@/components/PlanMeters";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { CLUB_CODES } from "@/lib/billing/club-codes";
import { KEEP_YEAR_AUD, overflowWindow, planName, suggestedTier, TIERS, tierOffers, windowCeiling } from "@/lib/billing/plans";
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
    <main className="flex max-w-[920px] flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={event.name} title="Plan and billing">
        One payment per event, no subscription. Every size has face search, your branding, the share kit and a gallery
        open for 12 months.
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

      <section className="soft-card flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{planName(event.plan)}</h2>
          {rateLabel ? <span className="soft-chip">{rateLabel}</span> : null}
          {event.billing_status === "comped" ? <span className="soft-chip">Complimentary</span> : null}
          {event.paid_at ? <span className="text-[14px] text-[color:var(--kb-ink-3)]">Paid {formatLongDate(event.paid_at)}</span> : null}
        </div>
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
              Guests can keep joining until {formatDateTime(windowEnds)}, up to {windowCeiling(event.guest_limit).toLocaleString("en-AU")}.
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
      </section>

      {offers.length && inApp ? (
        <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">The event&apos;s size can&apos;t be changed in the iPhone app.</p>
      ) : null}

      {offers.length && !inApp ? (
        <section className="flex flex-col gap-4" aria-labelledby="sizes">
          <h2 id="sizes" className="text-[18px] font-semibold">
            {event.plan === "free" ? "Choose a size" : "Upgrade"}
          </h2>
          <ExpectedGuestsForm eventId={event.id} expected={event.expected_guests} />
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {offers.map((offer) => {
              const tier = TIERS[offer.to];
              return (
                <div
                  key={offer.to}
                  className={`soft-card flex flex-col gap-3 p-5 ${suggestion === offer.to ? "outline outline-2 outline-[color:var(--kb-ember)]" : ""}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[17px] font-semibold">{tier.name}</span>
                    {suggestion === offer.to ? <span className="soft-chip">Fits your guests</span> : null}
                  </span>
                  <span className="text-[14px] text-[color:var(--kb-ink-2)]">
                    Up to {tier.guests.toLocaleString("en-AU")} guests · {tier.photos.toLocaleString("en-AU")} photos and videos
                  </span>
                  <span className="text-[32px] font-semibold leading-none tracking-[-0.03em]">A${offer.amount}</span>
                  <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                    {offer.kind === "upgrade"
                      ? `You've already paid for ${planName(offer.from)}, so you only pay the extra`
                      : "One payment for this event"}
                    {offer.late ? ", plus 25% because the event has already run out of room" : ""}.
                    {offer.rate === "club" ? " Club rate." : ""}
                  </span>
                  {devActivate ? null : (
                    <form action={startCheckoutAction.bind(null, event.id, offer.to)}>
                      <SubmitButton className="btn btn-primary w-full" pendingText="Opening secure checkout…" disabled={!configured}>
                        Pay A${offer.amount}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
          <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
            Each size includes 10% extra guests. If more turn up, they can keep joining for 2 days (up to 50% extra)
            while you upgrade. Upgrades bought once that has started cost 25% more.
            {offers[0]?.kind === "tier" ? " Have a promotion code? Enter it on the payment page." : ""}
          </p>
          {!event.plan_rate ? <ClubCodeForm eventId={event.id} code={event.club_code} campus={event.club_code ? (CLUB_CODES[event.club_code] ?? null) : null} /> : null}
          {!configured && !devActivate ? (
            <div className="notice">Payments aren&apos;t configured on this deployment yet (STRIPE_SECRET_KEY).</div>
          ) : null}
          <span className="text-[14px] text-[color:var(--kb-ink-3)]">
            Payments are handled by Stripe. We never see your card details. By paying you agree to the{" "}
            <Link href="/terms">terms</Link> and <Link href="/refunds">refund policy</Link>.
          </span>
        </section>
      ) : null}

      <section id="keep" className="soft-card flex scroll-mt-6 flex-col gap-3 p-6" aria-labelledby="keep-heading">
        <h2 id="keep-heading" className="text-[18px] font-semibold">
          How long photos are kept
        </h2>
        {event.photos_deleted_at ? (
          <p className="m-0 text-[15px] text-[color:var(--kb-ink-2)]">
            Photos from this event were deleted on {formatLongDate(event.photos_deleted_at)}, 12 months after the event.
          </p>
        ) : (
          <>
            <p className="m-0 max-w-[62ch] text-[15px] text-[color:var(--kb-ink-2)]">
              Photos, the guest list and face search data are kept until{" "}
              <strong>{formatLongDate(event.photos_delete_at)}</strong>, 12 months after the event
              {event.extra_years ? ` plus ${event.extra_years === 1 ? "a year" : `${event.extra_years} years`} kept` : ""}. We
              email you 30 and 7 days before. After that nothing can be recovered.
            </p>
            {inApp ? null : (
              <form action={startKeepYearAction.bind(null, event.id)} className="flex flex-wrap items-center gap-3">
                <SubmitButton className="btn btn-secondary" pendingText="Opening secure checkout…" disabled={!configured}>
                  Keep another year: A${KEEP_YEAR_AUD}
                </SubmitButton>
                <span className="text-[14px] text-[color:var(--kb-ink-3)]">
                  Keeps everything, and the gallery open, 12 months longer. Can be bought again each year.
                </span>
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

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SubmitButton } from "@/components/forms";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { BILLING_LABEL, isPaidStatus, type BillingStatus } from "@/lib/billing/status";
import { getPriceSummary, stripeConfigured, syncReturnedSession, type PriceSummary } from "@/lib/billing/stripe";
import { PRICE } from "@/lib/copy/site";
import { formatLongDate } from "@/lib/format";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { devActivateAction, openBillingPortalAction, startCheckoutAction } from "../../billing-actions";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage(props: PageProps<"/admin/[handle]/billing">) {
  const { handle } = await props.params;
  const search = await props.searchParams;
  const ctx = await requireAdminContext(handle);
  const configured = stripeConfigured();

  let status = ctx.event.billing_status as BillingStatus;
  let justPaid = false;
  if (configured && typeof search.session_id === "string" && !isPaidStatus(status)) {
    justPaid = await syncReturnedSession(search.session_id, ctx.event.id).catch((error) => {
      console.error("session sync failed", error);
      return false;
    });
    if (justPaid) status = "active";
  }
  if (typeof search.session_id === "string" && isPaidStatus(status)) justPaid = true;

  let price: PriceSummary | null = null;
  if (configured && !isPaidStatus(status)) {
    price = await getPriceSummary().catch((error) => {
      console.error("price lookup failed", error);
      return null;
    });
  }

  const writable = isPaidStatus(status);
  const devActivate = !configured && process.env.NODE_ENV !== "production";
  // Apple doesn't allow an iPhone app to sell digital services except through
  // in-app purchase, or to point people at another way to pay. So inside the
  // app this page reports the event's status and offers no payment controls.
  const inApp = isNativeAppUserAgent((await headers()).get("user-agent"));

  return (
    <main className="flex max-w-[920px] flex-col gap-6 pb-12 pt-2">
      <PageTitle kicker={ctx.event.name} title={writable ? "Billing" : "Activate the event"}>
        {writable ? undefined : PRICE.note}
      </PageTitle>

      {search.canceled ? <div className="notice">Checkout was cancelled. Nothing was charged.</div> : null}
      {search.error === "checkout" ? <div className="notice">We couldn&apos;t open checkout. Try again in a moment.</div> : null}
      {search.error === "portal" ? <div className="notice">We couldn&apos;t open your receipts. Try again in a moment.</div> : null}
      {!configured && !devActivate ? (
        <div className="notice">Payments aren&apos;t configured on this deployment yet (STRIPE_SECRET_KEY and STRIPE_PRICE_ID).</div>
      ) : null}

      {writable ? (
        <section className="soft-card flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="soft-chip">{BILLING_LABEL[status]}</span>
            {ctx.event.paid_at ? (
              <span className="text-[14px] text-[color:var(--ink-70)]">Paid {formatLongDate(ctx.event.paid_at)}</span>
            ) : null}
          </div>
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
            {justPaid ? "Paid. The event is active." : status === "comped" ? "This event is complimentary." : "The event is active."}
          </h2>
          <p className="m-0 max-w-[60ch] text-[15px] text-ink-70">
            Uploading, photographer links and attendees are unlocked. There is nothing more to pay for this event.
          </p>
          {inApp ? <p className="m-0 text-[14px] text-[color:var(--ink-70)]">Receipts aren&apos;t available in the iPhone app.</p> : null}
          <div className="flex flex-wrap gap-3">
            {justPaid ? (
              <Link href={`/admin/${handle}/setup`} className="btn btn-primary no-underline">
                Continue setting up
              </Link>
            ) : null}
            {ctx.event.stripe_customer_id && configured && !inApp ? (
              <form action={openBillingPortalAction.bind(null, ctx.event.id)}>
                <SubmitButton className="btn btn-secondary" pendingText="Opening…">
                  Receipts and invoices
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </section>
      ) : inApp ? (
        <section className="soft-card flex flex-col gap-3 p-6">
          <span className="soft-chip soft-chip-muted self-start">{BILLING_LABEL[status]}</span>
          <h2 className="text-[22px] font-semibold">{ctx.event.name} isn&apos;t active yet.</h2>
          <p className="m-0 max-w-[60ch] text-[15px] text-ink-70">
            Events can&apos;t be activated in the iPhone app. Once it&apos;s active, uploading and attendees unlock here too.
          </p>
        </section>
      ) : (
        <section className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div className="soft-card flex flex-col gap-4 p-6">
            <span className="kb-eyebrow">{PRICE.unit}</span>
            <div className="text-[40px] font-semibold leading-none tracking-[-0.03em]">{price?.label ?? PRICE.amount}</div>
            <ul className="m-0 flex list-none flex-col p-0 text-[15px]">
              {PRICE.includes.map((item) => (
                <li key={item} className="border-t border-[color:var(--kb-line)] py-2">
                  {item}
                </li>
              ))}
            </ul>
            {devActivate ? (
              <form action={devActivateAction.bind(null, ctx.event.id)}>
                <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Activating…">
                  Activate without payment (development)
                </SubmitButton>
              </form>
            ) : (
              <form action={startCheckoutAction.bind(null, ctx.event.id)}>
                <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Opening secure checkout…" disabled={!configured}>
                  Pay and activate
                </SubmitButton>
              </form>
            )}
            <span className="text-[14px] text-[color:var(--ink-55)]">
              Payments are handled by Stripe. We never see your card details. By activating you agree to the{" "}
              <Link href="/terms">terms</Link> and <Link href="/refunds">refund policy</Link>.
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-medium">What happens next</span>
            <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-normal text-ink-70">
              <li>1. Pay on Stripe&apos;s secure checkout page. Company cards and promo codes work.</li>
              <li>2. You come straight back here and the event unlocks.</li>
              <li>3. Add photographers, create albums and share the QR code.</li>
            </ol>
            <p className="m-0 text-[14px] text-[color:var(--ink-70)]">Need an invoice for your company? The receipt from Stripe includes your details.</p>
          </div>
        </section>
      )}
    </main>
  );
}

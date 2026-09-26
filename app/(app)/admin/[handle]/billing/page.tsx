import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SubmitButton } from "@/components/forms";
import { PageTitle } from "@/components/ui";
import { requireAdminContext } from "@/lib/auth/admin-context";
import { BILLING_LABEL, canWrite, type BillingStatus } from "@/lib/billing/status";
import { getDefaultCard, getPriceSummary, stripeConfigured, syncReturnedSession, type CardSummary, type PriceSummary } from "@/lib/billing/stripe";
import { formatLongDate } from "@/lib/format";
import { isNativeAppUserAgent } from "@/lib/native-app";
import { openBillingPortalAction, startCheckoutAction } from "../../billing-actions";

export const metadata: Metadata = { title: "Billing" };

const INCLUDED = [
  "Unlimited members from your roster",
  "Unlimited event albums, photos and videos at full quality",
  "Private sign-in with emailed codes, nothing public",
  "Access log and 30 day wind-down when people leave",
];

export default async function BillingPage(props: PageProps<"/admin/[handle]/billing">) {
  const { handle } = await props.params;
  const search = await props.searchParams;
  const ctx = await requireAdminContext(handle);
  const configured = stripeConfigured();

  let status = ctx.club.billing_status as BillingStatus;
  let justPaid = false;
  if (configured && typeof search.session_id === "string" && !canWrite(status)) {
    justPaid = await syncReturnedSession(search.session_id, ctx.club.id).catch((error) => {
      console.error("session sync failed", error);
      return false;
    });
    if (justPaid) status = "active";
  }
  if (typeof search.session_id === "string" && canWrite(status)) justPaid = true;

  let card: CardSummary = null;
  if (configured && ctx.club.stripe_customer_id) {
    card = await getDefaultCard(ctx.club).catch((error) => {
      console.error("card lookup failed", error);
      return null;
    });
  }

  let price: PriceSummary | null = null;
  if (configured && !canWrite(status)) {
    price = await getPriceSummary().catch((error) => {
      console.error("price lookup failed", error);
      return null;
    });
  }

  const onboarding = search.step === "2" || (status === "unpaid" && !justPaid);
  const writable = canWrite(status);
  // Apple doesn't allow an iPhone app to sell a subscription except through
  // in-app purchase, or to point people at another way to pay. So inside the
  // app this page reports the club's status and offers no payment controls.
  const inApp = isNativeAppUserAgent((await headers()).get("user-agent"));

  return (
    <main className="flex max-w-[920px] flex-col gap-6 px-6 py-8">
      <PageTitle kicker={onboarding && !writable ? "Step 2 of 4" : ctx.club.name} title={writable ? "Billing" : `Activate ${ctx.club.name}`} />

      {search.canceled ? <div className="notice">Checkout was cancelled. Nothing was charged.</div> : null}
      {search.error === "checkout" ? <div className="notice">We couldn&apos;t open checkout. Try again in a moment.</div> : null}
      {search.error === "portal" ? <div className="notice">We couldn&apos;t open the billing portal. Try again in a moment.</div> : null}
      {search.card === "saved" ? (
        <div className="border-l-4 border-ink bg-neutral-100 px-4 py-3 text-[14px]">Card saved. Future payments use it.</div>
      ) : null}
      {!configured ? (
        <div className="notice">
          Payments aren&apos;t configured on this deployment yet (STRIPE_SECRET_KEY and STRIPE_PRICE_ID).
        </div>
      ) : null}

      {writable ? (
        <section className="flex flex-col gap-4 soft-card p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={status === "past_due" ? "tag tag-accent-2" : "tag tag-outline"}>{BILLING_LABEL[status]}</span>
            {ctx.club.paid_at ? <span className="text-[14px] text-[color:var(--ink-70)]">Paid {formatLongDate(ctx.club.paid_at)}</span> : null}
            {card ? (
              <span className="text-[14px] text-[color:var(--ink-70)]">
                {card.brand.toUpperCase()} ending {card.last4} · expires {String(card.expMonth).padStart(2, "0")}/
                {String(card.expYear).slice(-2)}
              </span>
            ) : null}
          </div>
          <h2 className="display text-[32px]">{justPaid ? "You're all set." : status === "past_due" ? "Your last payment failed." : "Your club is active."}</h2>
          <p className="max-w-[56ch] text-[15px] text-ink-70">
            {status === "past_due"
              ? "Stripe will retry the card automatically. Update your payment details to avoid losing the ability to add members and upload."
              : status === "comped"
                ? "This club is on a complimentary plan."
                : "Members, albums and uploads are unlocked."}
          </p>
          {inApp ? (
            <p className="max-w-[56ch] text-[14px] text-[color:var(--ink-70)]">Billing can&apos;t be changed in the iPhone app.</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {justPaid ? (
              <Link href={`/admin/${handle}/members?step=3`} className="btn btn-primary">
                Continue to member list
              </Link>
            ) : null}
            {configured && !inApp ? (
              <Link href={`/admin/${handle}/billing/card`} className="btn btn-secondary">
                {card ? "Change card" : "Add a card"}
              </Link>
            ) : null}
            {ctx.club.stripe_customer_id && configured && !inApp ? (
              <form action={openBillingPortalAction.bind(null, ctx.club.id)}>
                <SubmitButton className="btn btn-ghost" pendingText="Opening…">
                  Invoices and cancellation
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </section>
      ) : inApp ? (
        <section className="flex flex-col gap-3 soft-card p-6">
          <span className="tag tag-outline self-start">{BILLING_LABEL[status]}</span>
          <h2 className="display text-[28px]">{ctx.club.name} isn&apos;t active yet.</h2>
          <p className="max-w-[56ch] text-[15px] text-ink-70">
            Clubs can&apos;t be activated in the iPhone app. Once the club is active, adding members and uploading unlock
            here too. Members can still open existing albums.
          </p>
        </section>
      ) : (
        <section className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div className="flex flex-col gap-4 border-2 border-ink p-6">
            <span className="kicker">{status === "canceled" ? "Reactivate" : "Klubbies for clubs"}</span>
            <div className="display text-[44px]">{price?.label ?? "—"}</div>
            <ul className="flex flex-col gap-2 text-[15px]">
              {INCLUDED.map((item) => (
                <li key={item} className="border-t border-divider pt-2">
                  {item}
                </li>
              ))}
            </ul>
            <form action={startCheckoutAction.bind(null, ctx.club.id)}>
              <SubmitButton className="btn btn-primary btn-lg w-full justify-start" pendingText="Opening secure checkout…" disabled={!configured}>
                {status === "canceled" ? "Reactivate club" : "Pay and activate"}
              </SubmitButton>
            </form>
            <span className="text-[14px] text-[color:var(--ink-55)]">
              Payments are handled by Stripe. Klubbies never sees your card details. By activating you agree to the{" "}
              <Link href="/terms">terms</Link> and <Link href="/refunds">refund and cancellation policy</Link>.
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-semibold">What happens next</span>
            <ol className="flex flex-col gap-3 text-[15px] leading-normal text-ink-70">
              <li>
                <strong>1.</strong> Pay on Stripe&apos;s secure checkout page.
              </li>
              <li>
                <strong>2.</strong> You come straight back here and the club unlocks.
              </li>
              <li>
                <strong>3.</strong> Import your member list and upload the first album.
              </li>
            </ol>
            {status === "canceled" ? (
              <p className="text-[14px] text-[color:var(--ink-70)]">
                Members can still open existing albums. Adding members and uploading resume once the club is active again.
              </p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}

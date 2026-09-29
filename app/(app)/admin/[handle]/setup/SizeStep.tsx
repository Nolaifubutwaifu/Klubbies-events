"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms";
import { suggestedTier, TIERS, type TierOffer } from "@/lib/billing/plans";
import { chooseSizeAction, type BillingFormState } from "@/app/(app)/admin/billing-actions";

/**
 * Step 3 of setting up: how many guests, then a size. The guest count is
 * asked first because it picks the size, and because choosing Free should be
 * a decision, not something that happens by default. Inside the iPhone app
 * only Free is offered and nothing mentions paying.
 */
export function SizeStep({
  eventId,
  expected,
  offers,
  inApp,
  payable,
}: {
  eventId: string;
  expected: number | null;
  /** Paid sizes this event can move to, with what each costs. */
  offers: TierOffer[];
  inApp: boolean;
  /** Stripe is configured, so paid sizes can be bought here. */
  payable: boolean;
}) {
  const [state, action, pending] = useActionState<BillingFormState, FormData>(chooseSizeAction.bind(null, eventId), {});
  const [guests, setGuests] = useState(expected ? String(expected) : "");
  const count = Number(guests) || 0;
  const fits = suggestedTier(count);
  const freeFits = count > 0 && count <= TIERS.free.guests;

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-medium">About how many guests are you expecting?</span>
        <span className="text-[14px] text-[color:var(--kb-ink-2)]">A rough number is fine. It picks the size that fits.</span>
        <input
          name="expected"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          required
          value={guests}
          onChange={(ev) => setGuests(ev.target.value)}
          className="input mt-1 w-[180px] !text-[18px]"
          placeholder="e.g. 120"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <SizeCard
          name={TIERS.free.name}
          price="A$0"
          detail={`Up to ${TIERS.free.guests} guests and ${TIERS.free.photos} photos`}
          highlighted={freeFits}
          note={count > TIERS.free.guests ? `More than ${TIERS.free.guests} guests is too many for Free` : null}
        >
          <button type="submit" name="tier" value="free" className={`btn ${freeFits || inApp ? "btn-primary" : "btn-secondary"} w-full`} disabled={pending}>
            {pending ? "Saving…" : "Continue with Free"}
          </button>
        </SizeCard>
        {inApp
          ? null
          : offers.map((offer) => (
              <SizeCard
                key={offer.to}
                name={TIERS[offer.to].name}
                price={`A$${offer.amount}`}
                detail={`Up to ${TIERS[offer.to].guests.toLocaleString("en-AU")} guests and ${TIERS[offer.to].photos.toLocaleString("en-AU")} photos`}
                highlighted={fits === offer.to}
                note={offer.rate === "club" ? "Club rate" : null}
              >
                <button
                  type="submit"
                  name="tier"
                  value={offer.to}
                  className={`btn ${fits === offer.to ? "btn-primary" : "btn-secondary"} w-full`}
                  disabled={pending || !payable}
                >
                  {pending ? "Opening checkout…" : `Pay A$${offer.amount}`}
                </button>
              </SizeCard>
            ))}
      </div>
      <FormMessage state={state} />
      <p className="m-0 text-[14px] text-[color:var(--kb-ink-3)]">
        {inApp
          ? "You can see your event's size any time on the Plan page."
          : "One payment per event, no subscription. You can move up a size later and only pay the extra."}
      </p>
    </form>
  );
}

function SizeCard({
  name,
  price,
  detail,
  highlighted,
  note,
  children,
}: {
  name: string;
  price: string;
  detail: string;
  highlighted: boolean;
  note: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-[var(--kb-r-card)] border bg-[color:var(--kb-white)] p-4 ${
        highlighted ? "border-[color:var(--kb-brand)] shadow-[0_0_0_1px_var(--kb-brand)]" : "border-[color:var(--kb-line)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span>
          <span className="block text-[16px] font-semibold">{name}</span>
          <span className="block text-[14px] text-[color:var(--kb-ink-2)]">{detail}</span>
        </span>
        <span className="text-[22px] font-semibold tracking-[-0.02em]">{price}</span>
      </div>
      {highlighted ? <span className="kb-pill-brand w-fit">Fits your guests</span> : null}
      {note ? <span className="text-[14px] text-[color:var(--kb-ink-3)]">{note}</span> : null}
      <div className="mt-auto">{children}</div>
    </div>
  );
}

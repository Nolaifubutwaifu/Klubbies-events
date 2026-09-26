"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

// Card details are typed on our own page; Stripe's iframe still handles the
// numbers, so we never see or store them.

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const appearance: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#cf2e12",
    colorBackground: "#ffffff",
    colorText: "#2b2228",
    colorDanger: "#ae1800",
    fontFamily: "DM Sans, system-ui, sans-serif",
    borderRadius: "14px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1.5px solid #968990", boxShadow: "none", padding: "14px" },
    ".Input:focus": { border: "2px solid #2b2228", boxShadow: "0 0 0 4px #ffe7df" },
    ".Label": { fontSize: "15px", fontWeight: "700" },
  },
};

function Inner({ clubId, doneHref }: { clubId: string; doneHref: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}${doneHref}` },
    });
    if (confirmError || !setupIntent) {
      setError(confirmError?.message ?? "That card wasn't accepted.");
      setBusy(false);
      return;
    }

    const res = await fetch("/api/stripe/card", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clubId, setupIntentId: setupIntent.id }),
    });
    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save that card.");
      setBusy(false);
      return;
    }
    router.push(`${doneHref}?card=saved`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-[460px] flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <div className="notice">{error}</div> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !stripe}>
          {busy ? "Saving…" : "Save card"}
        </button>
        <a href={doneHref} className="btn btn-ghost">
          Cancel
        </a>
      </div>
      <span className="text-[14px] text-ink-55">
        Card details go straight to Stripe. Klubbies only stores the brand and last four digits.
      </span>
    </form>
  );
}

export function CardForm({ clubId, doneHref }: { clubId: string; doneHref: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/stripe/card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId }),
      });
      const body: { clientSecret?: string; error?: string } = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok || !body.clientSecret) setError(body.error ?? "Could not open the card form.");
      else setClientSecret(body.clientSecret);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (!stripePromise) return <div className="notice">Card updates need NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.</div>;
  if (error) return <div className="notice">{error}</div>;
  if (!clientSecret) return <p className="text-[14px] text-ink-70">Opening the secure card form…</p>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <Inner clubId={clubId} doneHref={doneHref} />
    </Elements>
  );
}

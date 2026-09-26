export type BillingStatus = "unpaid" | "active" | "past_due" | "canceled" | "comped";

export const ACTIVATE_MESSAGE = "Activate your club to add members and upload. Go to Billing to finish setting up.";

/** Paid, still retrying a failed renewal, or comped by a super admin. */
export function canWrite(status: string): boolean {
  return status === "active" || status === "past_due" || status === "comped";
}

/** Maps a Stripe subscription status onto the club's billing status. */
export function statusFromSubscription(stripeStatus: string): Exclude<BillingStatus, "comped"> {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "unpaid";
  }
}

export const BILLING_LABEL: Record<BillingStatus, string> = {
  unpaid: "Not activated",
  active: "Active",
  past_due: "Payment failed",
  canceled: "Cancelled",
  comped: "Complimentary",
};

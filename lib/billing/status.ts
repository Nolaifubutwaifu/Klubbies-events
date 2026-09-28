export type BillingStatus = "unpaid" | "active" | "past_due" | "canceled" | "comped";

export const ACTIVATE_MESSAGE = "Activate the event to upload and add attendees. Go to Billing to finish setting up.";

/** Paid, still retrying a failed renewal, or comped by a super admin. */
export function isPaidStatus(status: string): boolean {
  return status === "active" || status === "past_due" || status === "comped";
}

/**
 * Whether the event can take uploads, photographers and attendees. A Free
 * event can without paying; its limits do the gating (migration 27). The
 * database's private.event_can_write says the same.
 */
export function canWrite(event: { billing_status: string; plan: string; photos_deleted_at?: string | null }): boolean {
  if (event.photos_deleted_at) return false; // deleted at 12 months: nothing new goes in
  return event.plan === "free" || isPaidStatus(event.billing_status);
}

/** Maps a Stripe subscription status onto the event's billing status. */
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

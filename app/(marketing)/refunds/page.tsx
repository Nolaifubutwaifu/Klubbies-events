import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refunds and cancellation" };

export default function RefundsPage() {
  return (
    <LegalPage
      doc="refunds"
      title="Refunds and cancellation"
      updated="16 September 2026"
      minutes={2}
      sections={[
        {
          title: "How billing works",
          body: (
            <p>
              A Klubbies club is a monthly subscription, charged in advance through Stripe on the same day each month.
              The price is shown before you pay and on every receipt.
            </p>
          ),
        },
        {
          title: "Cancelling",
          body: (
            <>
              <p>
                Club admins can cancel at any time from <strong>Admin → Billing → Manage billing and invoices</strong>.
                The subscription stays active until the end of the month you&apos;ve already paid for, and you won&apos;t
                be charged again.
              </p>
              <p>
                After that, the club can&apos;t add members or upload, but members can still open existing albums. We give
                at least 30 days&apos; notice before deleting a cancelled club&apos;s media.
              </p>
            </>
          ),
        },
        {
          title: "Refunds",
          body: (
            <>
              <p>
                We don&apos;t refund part months when you cancel. If you were charged by mistake, charged twice, or the
                service didn&apos;t work as described, contact us within 30 days and we&apos;ll put it right.
              </p>
              <p>
                Our services come with guarantees that cannot be excluded under the Australian Consumer Law. For a major
                failure you&apos;re entitled to cancel and receive a refund for the unused portion.
              </p>
            </>
          ),
        },
        {
          title: "Failed payments",
          body: (
            <p>
              If a renewal fails, Stripe retries the card over the following days and the club keeps working in the
              meantime. Update your card from the billing page. If payment still fails, the club is paused as if it had
              been cancelled.
            </p>
          ),
        },
        {
          title: "Questions",
          body: (
            <p>
              For anything billing related, <ContactLine />.
            </p>
          ),
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refunds" };

export default function RefundsPage() {
  return (
    <LegalPage
      doc="refunds"
      title="Refunds"
      updated="27 September 2026"
      minutes={1}
      sections={[
        {
          title: "How billing works",
          body: (
            <p>
              Small events are free. A bigger size is a single payment for that event, taken through Stripe, and an
              upgrade to a bigger size is another single payment for the difference. There is no subscription and
              nothing renews. The price is shown before you pay and on the receipt and invoice.
            </p>
          ),
        },
        {
          title: "Before anything is uploaded",
          body: (
            <p>
              If you activated an event and nothing has been uploaded to it yet, contact us within 30 days of payment
              and we will refund it in full.
            </p>
          ),
        },
        {
          title: "Mistakes and faults",
          body: (
            <>
              <p>
                If you were charged by mistake, charged twice, or the service didn&apos;t work as described, contact us
                within 30 days and we&apos;ll put it right.
              </p>
              <p>
                Our services come with guarantees that cannot be excluded under the Australian Consumer Law. For a major
                failure you&apos;re entitled to a refund.
              </p>
            </>
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

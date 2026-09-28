import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of service" };

// A draft written to match what the product does, for a lawyer to check.
export default function TermsPage() {
  return (
    <LegalPage
      doc="terms"
      title="Terms of service"
      updated="27 September 2026"
      minutes={3}
      sections={[
        {
          title: "Who we are",
          body: (
            <p>
              Klubbies Events is a private photo and video gallery service for events, operated from Queensland,
              Australia. By creating an event, signing in, uploading or paying you agree to these terms. To contact us,{" "}
              <ContactLine />.
            </p>
          ),
        },
        {
          title: "Organisers, photographers and attendees",
          body: (
            <>
              <p>
                An organiser creates an event, chooses who can get in, hands out photographer upload links and manages
                what is shared. Organisers are responsible for how their event is set up, including who holds the event
                link and who is on the guest list.
              </p>
              <p>
                Attendees sign in with their email address and a one-time code. Don&apos;t share codes or let other
                people use your access. Photographers who upload through a link may only upload to the event it was made
                for.
              </p>
            </>
          ),
        },
        {
          title: "Your content",
          body: (
            <>
              <p>
                Organisers and their photographers keep ownership of everything they upload. You give us permission to
                store, copy (for previews) and show that content to the people the organiser lets in, only so we can run
                the service.
              </p>
              <p>
                By uploading, the organiser confirms they have the right to share the content with their attendees, that
                people in the photos were told photography was taking place, and that they will act promptly on removal
                requests.
              </p>
            </>
          ),
        },
        {
          title: "Face search",
          body: (
            <p>
              If face search is on for an event, the organiser confirms they will tell attendees, for example in the
              invitation or on signage at the venue. We show every attendee a notice as well. The{" "}
              <Link href="/privacy">privacy policy</Link> explains how it works and how long faceprints are kept.
            </p>
          ),
        },
        {
          title: "Acceptable use",
          body: (
            <p>
              Don&apos;t upload anything unlawful, sexually explicit, or intended to harass, and don&apos;t use Klubbies
              Events to share content with people outside your event, to probe other events&apos; data, or to overload
              the service. We may suspend an event that breaks these rules.
            </p>
          ),
        },
        {
          title: "Access logging",
          body: (
            <p>
              We record when attendees view and download items, and the event&apos;s organisers can see that log. The{" "}
              <Link href="/privacy">privacy policy</Link> explains what is stored.
            </p>
          ),
        },
        {
          title: "Payment",
          body: (
            <p>
              An event is free up to the Free size&apos;s guest and photo limits. A bigger size is paid for once, through
              Stripe, and moving up a size costs the difference between the two, or the difference plus 25% once the
              event has run out of room. When an event is past its size, new guests can be refused and the guests who
              joined last paused, not removed, until the organiser upgrades or makes room, as described on the billing
              page. Prices include GST where applicable. Refunds are covered in the <Link href="/refunds">refund policy</Link>.
            </p>
          ),
        },
        {
          title: "Availability and liability",
          body: (
            <>
              <p>
                We work to keep the service available and your media safe, but we can&apos;t promise it will be
                uninterrupted or error free. Keep your own copies of anything irreplaceable; photographers should keep
                their originals.
              </p>
              <p>
                Nothing in these terms excludes rights you have under the Australian Consumer Law. To the extent the law
                allows, our total liability for an event is limited to the fee paid for that event.
              </p>
            </>
          ),
        },
        {
          title: "How long we keep an event",
          body: (
            <p>
              Attendees lose access on the closing date the organiser sets. We keep the event&apos;s media for
              organisers for at least 12 months after the event, and email them at least 30 days before deleting it, so
              they can download what they want to keep. When an organiser deletes a photo, an album or the whole event,
              it can be restored from Recently deleted for 30 days before it is deleted for good.
            </p>
          ),
        },
        {
          title: "The iPhone app",
          body: (
            <p>
              If you use the Klubbies Events iPhone app, Apple&apos;s standard Licensed Application End User License Agreement
              applies alongside these terms. These terms are between you and us, not Apple: Apple has no responsibility
              for the app, its content, its maintenance or support, or any claim about it. The app doesn&apos;t sell
              anything.
            </p>
          ),
        },
        {
          title: "Changes and governing law",
          body: (
            <p>
              We&apos;ll email organisers before making material changes to these terms. These terms are governed by the
              laws of Queensland, Australia.
            </p>
          ),
        },
      ]}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Support" };

// Also the App Store listing's support URL, so it has to answer the things
// Apple's reviewers look for: how to get help, how to report content, how to
// delete an account.
export default function SupportPage() {
  return (
    <LegalPage
      doc="support"
      title="Support"
      updated="27 September 2026"
      minutes={2}
      sections={[
        {
          title: "Get help",
          body: (
            <p>
              For anything about Klubbies Events, on the website or in the iPhone app, <ContactLine />. Tell us the
              event&apos;s name and what you were trying to do. We reply within two working days, and within 24 hours to a report of
              objectionable content.
            </p>
          ),
        },
        {
          title: "Can't sign in",
          body: (
            <p>
              Open the event&apos;s link or scan its QR code, then enter your email. If the organiser uses a guest list, use
              the address you registered with; the code only goes to addresses on it. Codes work for ten minutes, so ask
              for a new one if it has expired. Still nothing? Look in your spam folder, then ask the organiser to check
              your address.
            </p>
          ),
        },
        {
          title: "Report a photo or a person",
          body: (
            <>
              <p>
                If you&apos;re in a photo you want gone, open it and choose Request removal. It is hidden from attendees
                straight away while the organiser decides, and removed if they haven&apos;t answered within 7 days.
              </p>
              <p>
                For anything else, such as a photo that shouldn&apos;t be there, tell the organiser: they can remove any
                photo and take anyone off the attendee list. If it&apos;s serious or the organiser won&apos;t act,{" "}
                <ContactLine />. We remove objectionable content, and the person who posted
                it where warranted, within 24 hours.
              </p>
            </>
          ),
        },
        {
          title: "Delete your account",
          body: (
            <p>
              Open your profile and choose Delete my account, in the app or on the website. The{" "}
              <Link href="/privacy">privacy policy</Link> explains what that deletes and what stays with the event.
            </p>
          ),
        },
        {
          title: "Notifications",
          body: (
            <p>
              In the iPhone app, turn notifications on from your profile. You get one for each kind of email ticked
              there, so unticking New albums stops both. To stop them entirely, turn them off for Klubbies Events in
              iPhone Settings.
            </p>
          ),
        },
        {
          title: "Billing",
          body: (
            <p>
              The app doesn&apos;t sell anything. Organisers pay once per event on the website; refunds are covered in the{" "}
              <Link href="/refunds">refund policy</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}

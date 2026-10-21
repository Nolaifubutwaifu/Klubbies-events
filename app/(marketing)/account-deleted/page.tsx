import type { Metadata } from "next";
import Link from "next/link";
import { NoticePage } from "@/components/NoticePage";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Account deleted", robots: NO_INDEX };

export default function AccountDeletedPage() {
  return (
    <NoticePage
      badge="ok"
      title="Your account is deleted."
      actions={
        <Link href="/" className="btn btn-secondary no-underline">
          Back to the home page
        </Link>
      }
    >
      <p>
        Your sign-in, profile, saved photos and face recognition data are gone. Photos you appear in stay with the event
        that took them, and you can ask its organiser to remove any. If you&apos;re on an event&apos;s guest list, you can
        sign in again any time and start fresh.
      </p>
    </NoticePage>
  );
}

import Link from "next/link";
import { NoticePage } from "@/components/NoticePage";

export default function NotFound() {
  return (
    <NoticePage
      kicker="Error 404"
      eyebrow="Not here"
      title="This page isn't available."
      actions={
        <>
          <Link href="/events" className="btn btn-primary no-underline">
            Your events
          </Link>
          <Link href="/" className="btn btn-secondary no-underline">
            Home
          </Link>
        </>
      }
    >
      <p>
        The link may be old, or the event may be private. If someone shared it with you, ask them for the event&apos;s QR
        code.
      </p>
    </NoticePage>
  );
}

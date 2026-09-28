import Link from "next/link";
import { CREDIT_SOURCE } from "@/lib/attribution";

/**
 * "Photos by Klubbies Events" on attendee pages, on every size including paid
 * ones (pricing handoff §5.7). The links are tagged so sign ups from here can
 * be counted. Inside the iPhone app it is plain text: the link leads to a
 * paid product, and Apple allows no route to one from the app.
 */
export function CreditLine({ inApp }: { inApp: boolean }) {
  if (inApp) {
    return <p className="m-0 py-6 text-center text-[14px] text-[color:var(--kb-ink-3)]">Photos by Klubbies Events</p>;
  }
  return (
    <p className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-6 text-center text-[14px] text-[color:var(--kb-ink-3)]">
      <Link href={`/?src=${CREDIT_SOURCE.page}`} className="text-[color:var(--kb-ink-3)]">
        Photos by Klubbies Events
      </Link>
      <span aria-hidden>·</span>
      <Link href={`/start?src=${CREDIT_SOURCE.page}`} className="text-[color:var(--kb-ink-3)]">
        Run your own event
      </Link>
    </p>
  );
}

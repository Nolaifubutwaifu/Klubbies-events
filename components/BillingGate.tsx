import Link from "next/link";
import { formatLongDate } from "@/lib/format";
import { isNativeAppRequest } from "@/lib/native-app-server";

export async function BillingGate({
  handle,
  action,
  deletedAt,
}: {
  handle: string;
  action: string;
  /** Set once the event's photos were deleted at 12 months: nothing unlocks it. */
  deletedAt?: string | null;
}) {
  if (deletedAt) {
    return (
      <div className="dropzone items-start px-5 py-6 text-left" style={{ cursor: "default", gridColumn: "1 / -1" }}>
        <span className="text-[16px] font-semibold">This event&apos;s photos were deleted</span>
        <span className="max-w-[56ch] text-[14px] text-ink-70">
          Everything was deleted on {formatLongDate(deletedAt)}, 12 months after the event. Nothing new can be added.
        </span>
      </div>
    );
  }
  // Inside the iPhone app there is nowhere to pay (Apple allows no payment
  // prompts), so it says what's locked and stops there.
  const inApp = await isNativeAppRequest();
  return (
    <div className="dropzone items-start px-5 py-6 text-left" style={{ cursor: "default", gridColumn: "1 / -1" }}>
      <span className="text-[16px] font-semibold">{inApp ? "This event isn't active yet" : `Activate the event to ${action}`}</span>
      <span className="max-w-[56ch] text-[14px] text-ink-70">
        {inApp
          ? `Once it's active you can ${action} here.`
          : "Uploading, photographer links and adding attendees unlock after the one-off payment. Setting up is free."}
      </span>
      {inApp ? null : (
        <Link href={`/admin/${handle}/billing`} className="btn btn-primary mt-2 no-underline">
          Activate event
        </Link>
      )}
    </div>
  );
}

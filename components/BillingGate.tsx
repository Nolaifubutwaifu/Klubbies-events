import Link from "next/link";

export function BillingGate({ handle, action }: { handle: string; action: string }) {
  return (
    <div className="dropzone items-start px-5 py-6 text-left" style={{ cursor: "default", gridColumn: "1 / -1" }}>
      <span className="text-[16px] font-semibold">Activate the event to {action}</span>
      <span className="max-w-[56ch] text-[14px] text-ink-70">
        Uploading, photographer links and adding attendees unlock after the one-off payment. Setting up is free.
      </span>
      <Link href={`/admin/${handle}/billing`} className="btn btn-primary mt-2 no-underline">
        Activate event
      </Link>
    </div>
  );
}

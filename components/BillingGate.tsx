import Link from "next/link";

export function BillingGate({ handle, action }: { handle: string; action: string }) {
  return (
    <div className="dropzone px-4 py-8" style={{ cursor: "default", gridColumn: "1 / -1" }}>
      <span className="font-heading text-[18px] font-bold">Activate your club to {action}</span>
      <span className="max-w-[46ch] text-[14px] text-ink-70">
        Adding members and uploading unlock once the club is paid for. Existing albums stay visible to members.
      </span>
      <Link href={`/admin/${handle}/billing`} className="btn btn-primary mt-2">
        Activate club
      </Link>
    </div>
  );
}

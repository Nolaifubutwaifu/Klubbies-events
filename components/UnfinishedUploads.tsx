"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteMediaAction } from "@/app/(app)/admin/actions";
import { formatDateTime } from "@/lib/format";
import { EXPIRE_AFTER_DAYS } from "@/lib/media/constants";

/**
 * Names the files that never finished uploading, so nobody has to guess which
 * grey tile is which.
 */
export function UnfinishedUploads({
  items,
  addHref,
}: {
  items: { id: string; original_filename: string | null; created_at: string; status: string }[];
  addHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 border-b-2 border-divider border-l-4 border-l-accent bg-accent-100 px-6 py-4">
      <span className="text-[14px] text-accent-800">
        <strong>
          {items.length} {items.length === 1 ? "file" : "files"} didn&apos;t finish uploading.
        </strong>{" "}
        They aren&apos;t visible to members. Upload them again, or remove them from the album. Anything still
        unfinished {EXPIRE_AFTER_DAYS} days after it started is cleared out automatically.
      </span>
      <ul className="flex flex-col gap-1 text-[14px] text-accent-800">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{item.original_filename ?? "Unnamed file"}</span>
            <span className="text-ink-70">started {formatDateTime(item.created_at)}</span>
            <button
              type="button"
              className="btn btn-ghost text-[14px]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteMediaAction([item.id]);
                  router.refresh();
                })
              }
            >
              Remove it
            </button>
          </li>
        ))}
      </ul>
      <Link href={addHref} className="btn btn-primary self-start text-[14px]">
        Upload again
      </Link>
    </div>
  );
}

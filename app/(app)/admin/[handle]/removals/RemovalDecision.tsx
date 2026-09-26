"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog } from "@/components/Dialog";
import { confirmRemovalAction, restorePhotoAction } from "@/app/(app)/removal-actions";

export function RemovalDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) return setError(res.error);
      setConfirming(false);
      router.refresh();
    });

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => run(() => restorePhotoAction(requestId))}
        >
          Put it back
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => setConfirming(true)}>
          Delete it for good
        </button>
      </div>
      {error ? <p className="m-0 mt-2 text-[14px] text-accent-800">{error}</p> : null}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete this photo for good?">
        <p className="text-[15px]">
          The original goes with it and there is no undo. Anyone who already downloaded a copy keeps theirs.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => run(() => confirmRemovalAction(requestId))}
          >
            {pending ? "Deleting…" : "Delete it"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

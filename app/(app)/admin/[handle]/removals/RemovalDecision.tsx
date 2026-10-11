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
      <div className="flex flex-wrap gap-2 md:flex-col">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => setConfirming(true)}>
          Keep it removed
        </button>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(() => restorePhotoAction(requestId))}>
          Put it back
        </button>
      </div>
      {error ? <p className="kb-error m-0 mt-2">{error}</p> : null}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Keep it removed for good?">
        <p className="text-[15px]">
          The photo and its original are deleted, and there is no undo. Anyone who already downloaded a copy keeps theirs.
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
            {pending ? "Removing…" : "Keep it removed"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

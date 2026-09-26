"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/Dialog";
import { revokeGuestLinkAction } from "@/app/(app)/admin/guest-actions";

export function RevokeButton({ linkId, label }: { linkId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className="soft-btn soft-btn-tonal !min-h-[38px] !px-4 !text-[14px]" onClick={() => setOpen(true)}>
        Revoke
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Turn this link off?">
        <p className="text-[15px]">
          “{label}” stops working the moment you confirm. Everything already uploaded on it stays in the album.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await revokeGuestLinkAction(linkId);
                setOpen(false);
              })
            }
          >
            {pending ? "Revoking…" : "Revoke link"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

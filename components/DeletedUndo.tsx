"use client";

import { usePathname, useRouter } from "next/navigation";
import { UndoBar } from "@/components/UndoBar";
import { restoreAlbumAction, restoreEventAction } from "@/app/(app)/admin/actions";

/**
 * The Undo bar on the page a delete redirected to: the albums list after an
 * album, Your events after a whole event. The ?deleted= in the address is
 * dropped when the bar goes away, so a reload doesn't bring it back.
 */
export function DeletedUndo({ kind, id, name }: { kind: "album" | "event"; id: string; name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <UndoBar
      message={`Deleted ${name}`}
      onUndo={async () => {
        const res = kind === "album" ? await restoreAlbumAction(id) : await restoreEventAction(id);
        if (res.ok) router.refresh();
        return res;
      }}
      onDone={() => router.replace(pathname, { scroll: false })}
    />
  );
}

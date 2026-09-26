"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { setAreaAction } from "@/app/(app)/actions";

/** Switches area and returns to the same page, not the overview. */
export function ViewToggle({ area, handle }: { area: "member" | "admin"; handle: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const next = area === "admin" ? "member" : "admin";
  const query = params.toString();
  const here = `${pathname}${query ? `?${query}` : ""}`;
  // Admin-only pages have no member equivalent, so leaving them lands on the feed.
  const target = next === "member" && pathname.startsWith("/admin/") ? `/c/${handle}` : here;

  return (
    <button
      type="button"
      className="btn btn-secondary text-[14px]"
      disabled={pending}
      onClick={() => startTransition(() => setAreaAction(next, target))}
    >
      {pending ? "Switching…" : next === "admin" ? "Admin view" : "Member view"}
    </button>
  );
}

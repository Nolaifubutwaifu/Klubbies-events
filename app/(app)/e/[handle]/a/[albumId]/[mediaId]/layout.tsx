import type { ReactNode } from "react";

/**
 * The lightbox takes the window. Pinning it means the page behind can't add
 * its own height underneath, so the sheets really do sit on the bottom edge.
 */
export default function ViewerLayout({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#14100f]">{children}</div>;
}

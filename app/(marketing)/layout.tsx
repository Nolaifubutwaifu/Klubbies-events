import type { ReactNode } from "react";

/** Marketing and legal pages: each page brings the shared nav and footer. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="theme-soft flex flex-1 flex-col">{children}</div>;
}

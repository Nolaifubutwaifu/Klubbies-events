import type { ReactNode } from "react";
import { GoogleAds } from "@/components/GoogleAds";

/** Marketing and legal pages: each page brings the shared nav and footer. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-soft kb-branded flex flex-1 flex-col">
      <GoogleAds />
      {children}
    </div>
  );
}

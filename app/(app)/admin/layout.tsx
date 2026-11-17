import type { ReactNode } from "react";
import { GoogleAds } from "@/components/GoogleAds";

/**
 * Organiser pages under /admin, including the new-event form.
 * The printable poster lives in the print group and does not use this layout.
 */
export default function AdminSectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GoogleAds />
      {children}
    </>
  );
}

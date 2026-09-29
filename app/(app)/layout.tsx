import type { ReactNode } from "react";
import { AppFooter } from "@/components/AppFooter";
import { UploadProvider } from "./UploadProvider";
import { UploadTray } from "./UploadTray";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UploadProvider>
      <div className="theme-soft relative flex flex-1 flex-col">
        {/* Above the footer: the phone tab bar is fixed inside this, and on a
            short page the footer sits right under it and would take its taps. */}
        <div className="relative z-20 flex w-full flex-1 flex-col">{children}</div>
        <AppFooter />
      </div>
      <UploadTray />
    </UploadProvider>
  );
}

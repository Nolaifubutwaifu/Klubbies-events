import type { ReactNode } from "react";
import { AppFooter } from "@/components/AppFooter";
import { UploadProvider } from "./UploadProvider";
import { UploadTray } from "./UploadTray";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UploadProvider>
      <div className="theme-soft relative flex flex-1 flex-col">
        <div className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-1 flex-col">{children}</div>
        <AppFooter />
      </div>
      <UploadTray />
    </UploadProvider>
  );
}

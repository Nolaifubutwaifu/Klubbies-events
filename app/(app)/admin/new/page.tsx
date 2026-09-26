import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { CreateClubForm } from "./CreateClubForm";

export const metadata: Metadata = { title: "Create your club" };

export default async function NewClubPage() {
  await requireUser("/admin/new");
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[color:var(--kb-line)] px-4 py-3 sm:px-6">
        <Brand href="/clubs" size={24} />
        <Link href="/clubs" className="kb-link kb-link-quiet">
          Cancel
        </Link>
      </header>
      <CreateClubForm appUrl={appUrl()} />
    </main>
  );
}

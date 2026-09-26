import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { CreateEventForm } from "./CreateEventForm";

export const metadata: Metadata = { title: "Create your event" };

export default async function NewEventPage() {
  await requireUser("/admin/new");
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[color:var(--kb-line)] px-4 py-3 sm:px-6">
        <Brand href="/events" size={24} />
        <Link href="/events" className="kb-link kb-link-quiet">
          Cancel
        </Link>
      </header>
      <CreateEventForm appUrl={appUrl()} />
    </main>
  );
}

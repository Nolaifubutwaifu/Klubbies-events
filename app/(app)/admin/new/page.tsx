import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/env";
import { CreateEventForm } from "./CreateEventForm";

export const metadata: Metadata = { title: "Create an event" };

export default async function NewEventPage() {
  await requireUser("/admin/new");
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
        <div className="mx-auto flex min-h-[60px] w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href="/events" />
          <Link href="/events" className="kb-link kb-link-quiet">
            Cancel
          </Link>
        </div>
      </header>
      <CreateEventForm appUrl={appUrl()} />
    </main>
  );
}

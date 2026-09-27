import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/ui";

export const metadata: Metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-6 py-12">
      <Brand />
      <h1 className="serif text-[40px] leading-tight">Your account is deleted.</h1>
      <p className="text-[15px] leading-normal text-[color:var(--kb-ink-2)]">
        Your sign-in, profile, saved photos and face recognition data are gone. Photos you uploaded stay with the event.
        If you&apos;re on an event&apos;s guest list, you can sign in again any time and start fresh.
      </p>
      <Link href="/" className="btn btn-secondary self-start">
        Klubbies Events home
      </Link>
    </main>
  );
}

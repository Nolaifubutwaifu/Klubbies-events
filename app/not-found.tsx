import Link from "next/link";
import { Brand } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="theme-soft flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Brand />
      <div className="flex max-w-[520px] flex-col gap-3 py-12">
        <span className="kicker">Not here</span>
        <h1 className="display text-[40px]">This page isn&apos;t available.</h1>
        <p className="text-[15px] text-ink-70">
          It may not exist, or it belongs to a club your account isn&apos;t on. If you think you should have access, ask
          your committee to check the member list.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href="/clubs" className="btn btn-primary">
            My clubs
          </Link>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell, StepIndicator } from "@/components/AuthShell";
import { CheckIcon, LockIcon } from "@/components/soft/icons";
import { getSessionUser } from "@/lib/auth/session";
import { PRICE } from "@/lib/copy/site";
import { SignInForm } from "../signin/SignInForm";

export const metadata: Metadata = { title: "Start your club" };

/** The desktop panel: what members will get, not a marketing photo. */
function Preview() {
  return (
    <div className="flex h-full flex-col justify-center bg-[color:var(--kb-sand)] p-12 xl:p-16">
      <h2 className="max-w-[16ch] font-[family-name:var(--kb-font-display)] text-[40px] font-bold leading-[1.08]">
        What your members will see on <span className="kb-accent">Saturday</span>.
      </h2>
      <div className="kb-card mt-8 max-w-[440px] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[color:var(--kb-ink)] text-[15px] font-bold text-white">UM</span>
          <span className="flex-1">
            <span className="block font-[family-name:var(--kb-font-display)] text-[19px] font-semibold">UM Semester 2 Ball</span>
            <span className="block text-[14px] text-[color:var(--kb-ink-3)]">412 photos · 9 videos</span>
          </span>
          <span className="soft-chip">
            <LockIcon size={14} />
            Members only
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {["/marketing/hero-2.jpg", "/marketing/night-ball.jpg", "/marketing/hero-1.jpg"].map((src) => (
            <span key={src} className="relative block aspect-square overflow-hidden rounded-[12px]">
              <Image src={src} alt="" fill sizes="140px" className="object-cover" />
            </span>
          ))}
        </div>
      </div>
      <ul className="m-0 mt-8 flex list-none flex-col gap-3 p-0 text-[17px]">
        {["Only people on your member list get in", "Full quality photos and video, unlimited", "Members can find every photo they're in"].map((line) => (
          <li key={line} className="flex items-center gap-3">
            <CheckIcon size={20} className="text-[color:var(--kb-ember-deep)]" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function StartPage() {
  if (await getSessionUser()) redirect("/admin/new");

  return (
    <AuthShell
      panel={<Preview />}
      photo="/marketing/hero-4.jpg"
      topLink={
        <>
          <span className="hidden sm:inline">Already in a club? </span>
          <Link href="/signin" className="font-bold">
            Log in
          </Link>
        </>
      }
      footerLinks={[
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
        { href: "/refunds", label: "Refunds" },
      ]}
    >
      <StepIndicator current={1} />
      <AuthHeading>Start your club</AuthHeading>
      <p className="kb-lead mt-3 !text-[17px]">
        Five minutes, once. Confirm your email and you&rsquo;re the club&rsquo;s admin. Next you&rsquo;ll name the club.
      </p>

      <div className="mt-7">
        <SignInForm flow="create" />
      </div>

      <p className="kb-caption mt-5 text-center">
        {PRICE.line}. {PRICE.note}
      </p>
    </AuthShell>
  );
}

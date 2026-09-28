import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/AuthShell";
import { CheckIcon } from "@/components/soft/icons";
import { getSessionUser } from "@/lib/auth/session";
import { PRICE } from "@/lib/copy/site";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { SignInForm } from "../signin/SignInForm";

export const metadata: Metadata = { title: "Create an event" };

/** The desktop panel: what the organiser gets, in four lines. */
function Preview({ inApp }: { inApp: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center gap-8 bg-[color:var(--kb-ink)] p-12 text-white xl:p-16">
      <p className="serif m-0 max-w-[15ch] text-[52px] text-white">Ten minutes to set up. Photographers do the rest.</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[16px] text-white/90">
        {[
          "Your logo and colour on every screen",
          "Upload links for each photographer",
          "A QR code and poster for the venue",
          "Attendees find their own photos with a selfie",
        ].map((line) => (
          <li key={line} className="flex items-center gap-3">
            <CheckIcon size={18} className="text-[#9fb0f7]" />
            {line}
          </li>
        ))}
      </ul>
      {inApp ? null : (
        <p className="m-0 text-[14px] text-white/75">
          {PRICE.line}. {PRICE.note}
        </p>
      )}
    </div>
  );
}

export default async function StartPage() {
  if (await getSessionUser()) redirect("/admin/new");

  return (
    <AuthShell
      panel={<Preview inApp={await isNativeAppRequest()} />}
      topLink={
        <>
          <span className="hidden sm:inline">Already have an account? </span>
          <Link href="/signin" className="font-medium">
            Sign in
          </Link>
        </>
      }
      footerLinks={[
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
        { href: "/refunds", label: "Refunds" },
      ]}
    >
      <AuthHeading chip="Step 1 of 2">Create an event</AuthHeading>
      <p className="kb-lead mt-3 !text-[16px]">
        First confirm your work email. Next you&rsquo;ll add the event&rsquo;s name, dates and venue.
      </p>
      <div className="mt-7">
        <SignInForm flow="create" />
      </div>
    </AuthShell>
  );
}

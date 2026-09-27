import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthNote, AuthShell } from "@/components/AuthShell";
import { authEventPreview } from "@/lib/auth/preview";
import { getSessionUser } from "@/lib/auth/session";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/signin">) {
  const params = await props.searchParams;
  const eventHandle = typeof params.event === "string" ? params.event : undefined;
  const user = await getSessionUser();
  if (user) redirect(eventHandle ? `/e/${eventHandle}` : "/events");

  const event = await authEventPreview(eventHandle);

  if (event) {
    const open = event.accessMode === "link";
    return (
      <AuthShell event={event}>
        <AuthHeading>Get your photos</AuthHeading>
        <p className="kb-lead mt-3 !text-[16px]">
          {open
            ? "Use the email you'd like your photos under. We'll send a code to confirm it's you, then you're in."
            : "This event is for its guest list. Use the email you registered with, and we'll send you a code."}
        </p>
        <div className="mt-7">
          <SignInForm flow="join" event={event.handle} />
        </div>
        <AuthNote>
          {open
            ? "Your email is only used to sign you in and to tell you when new photos are published."
            : "Not sure which email you registered with? Check your ticket confirmation."}
        </AuthNote>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      topLink={
        <>
          <span className="hidden sm:inline">Organising an event? </span>
          <Link href="/start" className="font-medium">
            Create one
          </Link>
        </>
      }
    >
      <AuthHeading>Sign in</AuthHeading>
      <p className="kb-lead mt-3 !text-[16px]">
        Use the email you joined an event with. We&rsquo;ll send you a code, so there&rsquo;s no password to remember.
      </p>
      <div className="mt-7">
        <SignInForm flow="member" />
      </div>
      <AuthNote>
        Attending an event? The quickest way in is the link or QR code the organiser shared. It takes you straight to
        that event.
      </AuthNote>
    </AuthShell>
  );
}

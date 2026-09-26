import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthNote, AuthShell, type AuthEvent } from "@/components/AuthShell";
import { getPublicEvent, getSessionUser } from "@/lib/auth/session";
import { BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The event someone followed a link or QR for: its name, dates, host and
 * logo. No album counts and no photos: this page is public.
 */
async function eventPreview(handle: string | undefined): Promise<AuthEvent | null> {
  if (!handle) return null;
  try {
    const event = await getPublicEvent(handle);
    if (!event) return null;
    const logoUrl = event.logoPath
      ? ((await createAdminClient().storage.from(BUCKET).createSignedUrl(event.logoPath, 10 * 60)).data?.signedUrl ?? null)
      : null;
    return {
      name: event.name,
      handle: event.handle,
      organisation: event.organisation,
      logoUrl,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      venue: event.venue,
      accentColour: event.accentColour,
      accessMode: event.accessMode,
    };
  } catch (error) {
    console.error("event preview failed", error);
    return null;
  }
}

export default async function SignInPage(props: PageProps<"/signin">) {
  const params = await props.searchParams;
  const eventHandle = typeof params.event === "string" ? params.event : undefined;
  const user = await getSessionUser();
  if (user) redirect(eventHandle ? `/e/${eventHandle}` : "/events");

  const event = await eventPreview(eventHandle);

  if (event) {
    const open = event.accessMode === "link";
    return (
      <AuthShell event={event}>
        <AuthHeading>Get your photos</AuthHeading>
        <p className="kb-lead mt-3 !text-[16px]">
          {open
            ? "Enter your name and email. We'll send a code to confirm it's you, then you're in."
            : "This event is for its guest list. Use the email you registered with and we'll send you a code."}
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

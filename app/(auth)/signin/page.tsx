import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthNote, AuthShell } from "@/components/AuthShell";
import { ScanEventButton } from "@/components/ScanEventButton";
import { safeNextPath } from "@/lib/auth/next-path";
import { authEventPreview } from "@/lib/auth/preview";
import { getPublicEvent, getSessionUser } from "@/lib/auth/session";
import { EVENT_FULL_MESSAGE, eventIsFull } from "@/lib/billing/usage";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { AppLanding } from "./AppLanding";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default async function SignInPage(props: PageProps<"/signin">) {
  const params = await props.searchParams;
  const eventHandle = typeof params.event === "string" ? params.event : undefined;
  const user = await getSessionUser();
  if (user) redirect(safeNextPath(eventHandle ? `/e/${eventHandle}` : "/events") ?? "/events");

  const event = await authEventPreview(eventHandle);

  if (event) {
    const open = event.accessMode === "link";
    // Past its guest limit and overflow window (migration 27): say so before
    // anyone types their email, rather than after they've confirmed it.
    const publicEvent = await getPublicEvent(event.handle);
    const full = publicEvent ? await eventIsFull(publicEvent.id).catch(() => false) : false;
    return (
      <AuthShell event={event}>
        {/* On a phone the event's name above is the heading. */}
        <div className="max-lg:sr-only">
          <AuthHeading>Get your photos</AuthHeading>
        </div>
        <p className="text-[16px] text-[color:var(--kb-ink-2)] lg:mt-3">
          {open
            ? "Use the email you'd like your photos under. We'll send a code to confirm it's you, then you're in."
            : "This event is for its guest list. Use the email you registered with, and we'll send you a code."}
        </p>
        {full ? (
          <p className="kb-info mt-5" role="status">
            {EVENT_FULL_MESSAGE} If you&apos;ve already joined, sign in as usual.
          </p>
        ) : null}
        <div className="mt-6">
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

  // The app opens on a screen of buttons; "Sign in with email" comes here.
  const inApp = await isNativeAppRequest();
  if (inApp && params.with !== "email") return <AppLanding />;

  return (
    <AuthShell
      topLink={
        inApp ? (
          <Link href="/signin" className="font-medium">
            Back
          </Link>
        ) : null
      }
    >
      <AuthHeading>Sign in</AuthHeading>
      <p className="mt-2.5 text-[17px] text-[color:var(--kb-ink-2)]">We&apos;ll email you a code. There&apos;s no password to remember.</p>
      <div className="mt-6 flex flex-col gap-3">
        {inApp ? null : <ScanEventButton />}
        <SignInForm flow="member" />
        {inApp ? null : (
          <p className="m-0 mt-2 border-t border-[color:var(--kb-line)] pt-5 text-center text-[14px] text-[color:var(--kb-ink-2)]">
            Running an event?{" "}
            <Link href="/start" className="font-semibold">
              Create one
            </Link>
          </p>
        )}
      </div>
      <AuthNote>
        Attending an event? The quickest way in is the link or QR code the organiser shared. It takes you straight to
        that event.
      </AuthNote>
    </AuthShell>
  );
}

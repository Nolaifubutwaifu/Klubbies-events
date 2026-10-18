import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CreditLine } from "@/components/event/CreditLine";
import { EventIntro } from "@/components/event/EventIntro";
import { JoinEvent } from "@/components/event/JoinEvent";
import { MemberTabBar } from "@/components/MemberTabBar";
import { EventMark } from "@/components/EventMark";
import { BrandTile } from "@/components/ui";
import { getEventContext, getPublicEvent, getSessionUser } from "@/lib/auth/session";
import { faceStateFor } from "@/lib/faces/queries";
import { formatLongDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isNativeAppRequest } from "@/lib/native-app-server";
import { eventToneStyle } from "@/lib/theme";

export default async function EventLayout(props: LayoutProps<"/e/[handle]">) {
  const { handle } = await props.params;

  // The QR on the poster points here. Signed out, the event's own join page
  // is the right door, not a generic sign-in.
  const user = await getSessionUser();
  if (!user) redirect(`/signin?event=${encodeURIComponent(handle.toLowerCase())}`);

  const ctx = await getEventContext(handle);
  if (!ctx) {
    const event = await getPublicEvent(handle);
    if (!event) notFound();
    const logo = event.logoPath
      ? ((await signLogoMarks(createAdminClient(), [event.logoPath])).get(event.logoPath) ?? null)
      : null;
    return (
      <Door accentColour={event.accentColour}>
        <EventIntro
          name={event.name}
          organisation={event.organisation}
          startsOn={event.startsOn}
          endsOn={event.endsOn}
          venue={event.venue}
          logoUrl={logo}
          accentColour={event.accentColour}
        >
          <JoinEvent handle={event.handle} mode={event.accessMode} email={user.email ?? ""} />
        </EventIntro>
      </Door>
    );
  }

  const supabase = await createClient();
  const faceState = await faceStateFor(supabase, ctx.event.id, ctx.userId);

  if (ctx.accessClosed || ctx.paused || ctx.nameReview) {
    const logo = ctx.event.logo_path
      ? ((await signLogoMarks(supabase, [ctx.event.logo_path])).get(ctx.event.logo_path) ?? null)
      : null;
    const closed = ctx.accessClosed;
    const review = !closed && !ctx.paused && ctx.nameReview;
    const host = ctx.event.organisation ?? "the organiser";
    return (
      <div className="flex flex-1 flex-col bg-[color:var(--kb-cream)]" style={eventToneStyle(ctx.event.accent_colour)}>
        {/* The event's colour, its mark over the edge: the event vouches for the message. */}
        <div className="relative h-[180px] bg-[color:var(--kb-ember)] sm:h-[220px]">
          <span className="absolute -bottom-9 left-1/2 w-full max-w-[640px] -translate-x-1/2 px-5 sm:px-8">
            <span className="inline-block rounded-[18px] bg-[color:var(--kb-cream)] p-1">
              <EventMark name={ctx.event.name} logoUrl={logo} accentColour={ctx.event.accent_colour} size={72} />
            </span>
          </span>
        </div>
        <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-start gap-4 px-5 pb-16 pt-14 sm:px-8">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[color:var(--kb-ember)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            {closed ? `Closed on ${formatLongDate(ctx.event.access_ends_at)}` : review ? "Waiting for the organiser" : "Full for now"}
          </span>
          <h1 className="serif text-[40px] leading-[1.02] sm:text-[48px]">
            {closed ? "This gallery has closed" : review ? "The organiser will let you in" : "This gallery is full for now"}
          </h1>
          {review ? (
            <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">
              You signed in as &ldquo;{ctx.membership?.claimed_name}&rdquo;, which isn&apos;t the name on the guest list for{" "}
              {ctx.event.name}. We&apos;ve asked {host} to confirm it&apos;s you. Once they do, the photos open here; you
              don&apos;t need to sign in again.
            </p>
          ) : closed ? (
            <>
              <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">
                {ctx.event.name} is no longer open to attendees. Photos you saved or downloaded are still yours, and your
                selfie and face data were deleted when it closed.
              </p>
              <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">
                If you need a photo, ask {host}, who ran the event. <Link href="/support#contact">We can pass your message on</Link>.
              </p>
            </>
          ) : (
            <p className="m-0 text-[16px] text-[color:var(--kb-ink-2)]">
              We&apos;ve asked the organiser to make room, and we&apos;ll email you when it opens. Your selfie and saved photos
              are kept.
            </p>
          )}
          <Link href="/events" className="btn btn-secondary mt-2 no-underline">
            Your other events
          </Link>
        </main>
        <CreditLine inApp={await isNativeAppRequest()} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" style={eventToneStyle(ctx.event.accent_colour)}>
      <AppHeader ctx={ctx} area="attendee" facesEnabled={faceState.enabled} />
      <div className="flex min-w-0 flex-1 flex-col">{props.children}</div>
      <CreditLine inApp={await isNativeAppRequest()} />
      <MemberTabBar handle={handle} facesEnabled={faceState.enabled} />
    </div>
  );
}

/** The quiet single-column screen used when the event itself can't open. */
async function Door({ accentColour, children }: { accentColour: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col" style={eventToneStyle(accentColour)}>
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-10 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <a href="/events" aria-label="Your events" className="w-fit">
          <BrandTile size={28} />
        </a>
        {children}
      </div>
      <CreditLine inApp={await isNativeAppRequest()} />
    </div>
  );
}

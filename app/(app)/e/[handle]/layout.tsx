import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { EventIntro } from "@/components/event/EventIntro";
import { JoinEvent } from "@/components/event/JoinEvent";
import { MemberTabBar } from "@/components/MemberTabBar";
import { BrandTile } from "@/components/ui";
import { getEventContext, getPublicEvent, getSessionUser } from "@/lib/auth/session";
import { faceStateFor } from "@/lib/faces/queries";
import { formatLongDate } from "@/lib/format";
import { signLogoMarks } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

  if (ctx.accessClosed) {
    const logo = ctx.event.logo_path
      ? ((await signLogoMarks(supabase, [ctx.event.logo_path])).get(ctx.event.logo_path) ?? null)
      : null;
    return (
      <Door accentColour={ctx.event.accent_colour}>
        <EventIntro
          name={ctx.event.name}
          organisation={ctx.event.organisation}
          startsOn={ctx.event.starts_on}
          endsOn={ctx.event.ends_on}
          venue={ctx.event.venue}
          logoUrl={logo}
          accentColour={ctx.event.accent_colour}
        >
          <div className="kb-info max-w-[52ch] flex-col">
            <strong>This gallery closed on {formatLongDate(ctx.event.access_ends_at)}.</strong>
            <span>
              The organiser set it to close after the event. If you still need a photo, contact
              {ctx.event.organisation ? ` ${ctx.event.organisation}` : " the organiser"} directly.
            </span>
          </div>
        </EventIntro>
      </Door>
    );
  }

  return (
    <div className="flex flex-1 flex-col" style={eventToneStyle(ctx.event.accent_colour)}>
      <AppHeader ctx={ctx} area="attendee" facesEnabled={faceState.enabled} />
      <div className="flex min-w-0 flex-1 flex-col">{props.children}</div>
      <MemberTabBar handle={handle} facesEnabled={faceState.enabled} />
    </div>
  );
}

/** The quiet single-column screen used when the event itself can't open. */
function Door({ accentColour, children }: { accentColour: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col" style={eventToneStyle(accentColour)}>
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-10 px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <a href="/events" aria-label="Your events" className="w-fit">
          <BrandTile size={28} />
        </a>
        {children}
      </div>
    </div>
  );
}

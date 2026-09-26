import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MemberSidebar } from "@/components/MemberSidebar";
import { MemberTabBar } from "@/components/MemberTabBar";
import { getEventContext, getProfile, listMyEvents } from "@/lib/auth/session";
import { displayNameFor } from "@/lib/auth/display-name";
import { countPhotosOfYou, faceStateFor } from "@/lib/faces/queries";
import { SIGNED_URL_TTL, signLogoMarks, signPaths } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { eventToneStyle } from "@/lib/theme";

export default async function EventLayout(props: LayoutProps<"/e/[handle]">) {
  const { handle } = await props.params;
  const ctx = await getEventContext(handle);
  if (!ctx) notFound();

  const supabase = await createClient();
  const [{ events }, profile, displayName, saved, fresh, faceState] = await Promise.all([
    listMyEvents(),
    getProfile(),
    displayNameFor(ctx),
    supabase.from("favourites").select("media_id", { count: "exact", head: true }).eq("event_id", ctx.event.id).eq("user_id", ctx.userId),
    // "New since you were here", the same rule the album cards use.
    ctx.membership?.last_seen_at
      ? supabase
          .from("albums")
          .select("id", { count: "exact", head: true })
          .eq("event_id", ctx.event.id)
          .eq("status", "published")
          .gt("published_at", ctx.membership.last_seen_at)
      : Promise.resolve({ count: 0 }),
    faceStateFor(supabase, ctx.event.id, ctx.userId),
  ]);

  // The rail shows the row only where the feature exists for this member:
  // off for the event, or never enrolled, and it is not there at all.
  const facesCount =
    faceState.enabled && faceState.profile?.status === "ready"
      ? await countPhotosOfYou(supabase, ctx.event.id)
      : null;

  // One signing call for every event logo in the rail, not one per event, and
  // the 96px mark rather than the original upload.
  const signedLogos = await signLogoMarks(supabase, events.map((event) => event.logoPath));
  const logoUrls: Record<string, string> = {};
  for (const event of events) {
    const url = event.logoPath ? signedLogos.get(event.logoPath) : null;
    if (url) logoUrls[event.eventId] = url;
  }

  const avatarUrl = profile?.avatar_url
    ? ((await signPaths(supabase, [profile.avatar_url], SIGNED_URL_TTL.display)).get(profile.avatar_url) ?? null)
    : null;

  return (
    <div className="flex flex-1 flex-col" style={eventToneStyle(ctx.event.accent_colour)}>
      {/* Wide screens get the rail instead of a top bar — the design puts every
          event you're in down the left and nothing above the photos. */}
      <div className="lg:hidden">
        <AppHeader ctx={ctx} photosOfYou={facesCount !== null} />
      </div>
      <div className="flex flex-1 flex-col lg:flex-row lg:items-start lg:gap-6 lg:px-6 lg:pt-5">
        <MemberSidebar
          handle={handle}
          events={events}
          savedCount={saved.count ?? 0}
          newCount={fresh.count ?? 0}
          facesCount={facesCount}
          // Every /admin page asks for manage_event (requireAdminContext), so
          // that is the permission that earns the link. Anything wider led a
          // media officer to a 404.
          canManage={ctx.isAdmin}
          logoUrls={logoUrls}
          person={{ name: displayName, role: ctx.role?.name ?? "Member", avatarUrl }}
        />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
      <MemberTabBar handle={handle} photosOfYou={facesCount !== null} />
    </div>
  );
}

import "server-only";
import type { AuthEvent } from "@/components/AuthShell";
import { getPublicEvent } from "@/lib/auth/session";
import { BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The event someone followed a link or QR for, as the public sign-in screens
 * show it: name, dates, venue, host and logo. No counts and no photos.
 */
export async function authEventPreview(handle: string | undefined): Promise<AuthEvent | null> {
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

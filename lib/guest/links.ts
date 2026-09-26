import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// A guest photographer has no account. The link they hold is the whole
// credential, so it is long, single-purpose, and stored only as a hash: a
// leaked backup can't be turned back into a working upload link.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Three dash-separated groups, e.g. 7hK2-wRq9-mB4t — readable down a phone line. */
export function newGuestToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type GuestSession = {
  linkId: string;
  eventId: string;
  albumId: string;
  label: string;
  eventName: string;
  eventAccent: string | null;
  albumTitle: string;
  albumDate: string | null;
  expiresAt: string;
  fileCount: number;
};

export type GuestLinkState = "ok" | "unknown" | "revoked" | "expired" | "unpaid";

/**
 * Looks a token up with the service role — the guest is anonymous, so there is
 * no policy that could do this for us. Returns why it failed, because the
 * upload page says something different for each case.
 */
export async function resolveGuestLink(
  token: string,
): Promise<{ state: GuestLinkState; session: GuestSession | null }> {
  if (!/^[A-Za-z0-9-]{4,64}$/.test(token)) return { state: "unknown", session: null };
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("album_guest_links")
    .select("id, event_id, album_id, label, expires_at, revoked_at, file_count")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!link) return { state: "unknown", session: null };
  if (link.revoked_at) return { state: "revoked", session: null };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { state: "expired", session: null };

  const [{ data: event }, { data: album }] = await Promise.all([
    admin.from("events").select("name, accent_colour, billing_status").eq("id", link.event_id).maybeSingle(),
    admin.from("albums").select("title, album_date").eq("id", link.album_id).maybeSingle(),
  ]);
  if (!event || !album) return { state: "unknown", session: null };
  if (!["active", "past_due", "comped"].includes(event.billing_status)) return { state: "unpaid", session: null };

  return {
    state: "ok",
    session: {
      linkId: link.id,
      eventId: link.event_id,
      albumId: link.album_id,
      label: link.label,
      eventName: event.name,
      eventAccent: event.accent_colour,
      albumTitle: album.title,
      albumDate: album.album_date,
      expiresAt: link.expires_at,
      fileCount: link.file_count,
    },
  };
}

/** Counts a finished upload against the link, so the committee sees the tally. */
export async function recordGuestUpload(linkId: string, bytes: number): Promise<void> {
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("album_guest_links")
    .select("file_count, byte_total, first_used_at")
    .eq("id", linkId)
    .maybeSingle();
  if (!link) return;
  const now = new Date().toISOString();
  await admin
    .from("album_guest_links")
    .update({
      file_count: link.file_count + 1,
      byte_total: link.byte_total + Math.max(0, bytes),
      first_used_at: link.first_used_at ?? now,
      last_used_at: now,
    })
    .eq("id", linkId);
}

// Canonical object names the app writes under a media folder. Kept free of
// server-only so the signer and the tests share one check.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MEDIA_OBJECT_NAMES = [
  "original.jpg",
  "original.jpeg",
  "original.png",
  "original.heic",
  "original.heif",
  "original.webp",
  "original.mp4",
  "original.mov",
  "thumb.webp",
  "display.webp",
  "poster.jpg",
] as const;

export function hasPathTraversal(path: string): boolean {
  return path.includes("..") || path.includes("\\") || path.startsWith("/") || path.includes("\0");
}

/** True when path is this row's own file, and one of the names the app writes. */
export function ownedMediaObjectPath(eventId: string, albumId: string, mediaId: string, path: string): boolean {
  if (!UUID.test(eventId) || !UUID.test(albumId) || !UUID.test(mediaId)) return false;
  if (hasPathTraversal(path)) return false;
  const prefix = `events/${eventId}/albums/${albumId}/${mediaId}/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return (MEDIA_OBJECT_NAMES as readonly string[]).includes(name);
}

/** True when path is a single file under avatars/{this user}/. */
export function ownedAvatarPath(userId: string, path: string): boolean {
  if (!UUID.test(userId) || hasPathTraversal(path)) return false;
  const prefix = `avatars/${userId}/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return name.length > 0 && !name.includes("/") && /^[A-Za-z0-9._-]+$/.test(name);
}

/** Logo or cover under this event, one path segment, no traversal. */
export function ownedEventAssetPath(eventId: string, path: string): boolean {
  if (!UUID.test(eventId) || hasPathTraversal(path)) return false;
  const logo = `events/${eventId}/logo/`;
  const covers = `events/${eventId}/covers/`;
  const name = path.startsWith(logo) ? path.slice(logo.length) : path.startsWith(covers) ? path.slice(covers.length) : "";
  return name.length > 0 && !name.includes("/") && /^[A-Za-z0-9._-]+$/.test(name);
}

/** A selfie the server stored at faces/{membership id}/file. */
export function ownedSelfiePath(path: string): boolean {
  if (hasPathTraversal(path)) return false;
  return /^faces\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/i.test(path);
}

export type PathClaim =
  | { kind: "media"; path: string; eventId: string; albumId: string; mediaId: string }
  | { kind: "avatar"; path: string; userId: string }
  | { kind: "event"; path: string; eventId: string }
  | { kind: "selfie"; path: string };

export function claimAllowed(claim: PathClaim): boolean {
  if (claim.kind === "media") return ownedMediaObjectPath(claim.eventId, claim.albumId, claim.mediaId, claim.path);
  if (claim.kind === "avatar") return ownedAvatarPath(claim.userId, claim.path);
  if (claim.kind === "event") return ownedEventAssetPath(claim.eventId, claim.path);
  return ownedSelfiePath(claim.path);
}

export function mediaClaim(
  row: { event_id: string; album_id: string | null; id: string },
  path: string | null | undefined,
): PathClaim | null {
  if (!path || !row.album_id) return null;
  return { kind: "media", path, eventId: row.event_id, albumId: row.album_id, mediaId: row.id };
}

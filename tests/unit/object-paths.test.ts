import { describe, expect, it } from "vitest";
import { claimAllowed, ownedAvatarPath, ownedMediaObjectPath, ownedSelfiePath } from "@/lib/storage/object-paths";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ALBUM = "33333333-3333-4333-8333-333333333333";
const MEDIA = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";

describe("owned media paths", () => {
  const own = `events/${A}/albums/${ALBUM}/${MEDIA}/original.jpg`;

  it("accepts this row's own original and derivatives", () => {
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, own)).toBe(true);
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, `events/${A}/albums/${ALBUM}/${MEDIA}/thumb.webp`)).toBe(true);
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, `events/${A}/albums/${ALBUM}/${MEDIA}/display.webp`)).toBe(true);
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, `events/${A}/albums/${ALBUM}/${MEDIA}/poster.jpg`)).toBe(true);
  });

  it("rejects another event's original stored on this row", () => {
    const stolen = `events/${B}/albums/${ALBUM}/${OTHER}/original.jpg`;
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, stolen)).toBe(false);
    expect(claimAllowed({ kind: "media", path: stolen, eventId: A, albumId: ALBUM, mediaId: MEDIA })).toBe(false);
  });

  it("rejects traversal and unknown names", () => {
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, `events/${A}/albums/${ALBUM}/${MEDIA}/../${OTHER}/original.jpg`)).toBe(false);
    expect(ownedMediaObjectPath(A, ALBUM, MEDIA, `events/${A}/albums/${ALBUM}/${MEDIA}/secret.bin`)).toBe(false);
  });
});

describe("owned selfie paths", () => {
  it("rejects a query string on an otherwise valid selfie", () => {
    const id = "66666666-6666-4666-8666-666666666666";
    expect(ownedSelfiePath(`faces/${id}/selfie.jpg`)).toBe(true);
    expect(ownedSelfiePath(`faces/${id}/selfie.jpg?token=secret`)).toBe(false);
    expect(ownedSelfiePath(`faces/${id}/selfie.jpg#x`)).toBe(false);
  });
});

describe("owned avatar paths", () => {
  it("accepts a file under this user and rejects another user's", () => {
    expect(ownedAvatarPath(A, `avatars/${A}/avatar-1.jpg`)).toBe(true);
    expect(ownedAvatarPath(A, `avatars/${B}/avatar-1.jpg`)).toBe(false);
    expect(ownedAvatarPath(A, `events/${B}/albums/${ALBUM}/${MEDIA}/original.jpg`)).toBe(false);
  });
});

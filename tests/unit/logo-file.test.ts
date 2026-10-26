import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ACCEPTED_TYPES, EVENT_MEDIA_MIME_TYPES } from "@/lib/media/constants";
import {
  CROP_MAX_INPUT_PIXELS,
  GALLERY_MAX_INPUT_PIXELS,
  LOGO_MAX_INPUT_PIXELS,
  cropDecodeOptions,
  isAlbumCoverPath,
  isDecodablePhoto,
  isDeletableStorageKey,
  isEventLogoPath,
  isHeic,
  isPng,
  isRasterLogo,
  isWebp,
  logoDecodeOptions,
  logoRejection,
  looksLikeSvg,
  rasterLogoMark,
  sharpDecodeOptions,
} from "@/lib/media/logo-file";

const svg = new TextEncoder().encode(
  `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#ec3013"/></svg>`,
);

async function sample(format: "png" | "jpeg" | "webp"): Promise<Uint8Array> {
  const image = sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 226, g: 48, b: 19 } } });
  const encoded = format === "png" ? image.png() : format === "jpeg" ? image.jpeg({ quality: 90 }) : image.webp({ quality: 90 });
  return new Uint8Array(await encoded.toBuffer());
}

describe("logo file gate", () => {
  it("accepts PNG, JPEG and WebP and builds the webp badge", async () => {
    for (const [format, ext] of [
      ["png", "png"],
      ["jpeg", "jpg"],
      ["webp", "webp"],
    ] as const) {
      const bytes = await sample(format);
      expect(isRasterLogo(bytes)).toBe(true);
      expect(looksLikeSvg(bytes)).toBe(false);
      expect(logoRejection(`events/abc/logo/logo.${ext}`, bytes)).toBeNull();
      const mark = await rasterLogoMark(bytes, 96);
      expect(isWebp(new Uint8Array(mark))).toBe(true);
      const meta = await sharp(mark).metadata();
      expect(meta.width).toBe(96);
      expect(meta.height).toBe(96);
      expect(meta.format).toBe("webp");
    }
  });

  it("rejects SVG before sharp, including a renamed or encoded file", () => {
    expect(looksLikeSvg(svg)).toBe(true);
    expect(logoRejection("events/abc/logo/logo.svg", svg)).toBe("Use a PNG, JPG or WebP logo");
    expect(logoRejection("events/abc/logo/logo.png", svg)).toBe("Use a PNG, JPG or WebP logo");
    const commented = new TextEncoder().encode(`<!-- logo --><?xml version="1.0"?>\n${new TextDecoder().decode(svg)}`);
    expect(looksLikeSvg(commented)).toBe(true);
    const utf16 = Buffer.from(`\uFEFF<svg xmlns="http://www.w3.org/2000/svg"></svg>`, "utf16le");
    expect(looksLikeSvg(utf16)).toBe(true);
  });

  it("does not treat a PNG that mentions svg in a later chunk as SVG", async () => {
    const png = await sample("png");
    const withNote = new Uint8Array(png.length + 16);
    withNote.set(png);
    withNote.set(new TextEncoder().encode("<svg></svg>"), png.length);
    expect(isRasterLogo(withNote)).toBe(true);
    expect(looksLikeSvg(withNote)).toBe(false);
    expect(logoRejection("events/abc/logo/logo.png", withNote)).toBeNull();
  });

  it("rejects an oversized raster", async () => {
    const png = await sample("png");
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(png.subarray(0, 8));
    expect(logoRejection("events/abc/logo/logo.png", big)).toBe("Use a PNG, JPG or WebP logo");
  });

  it("leaves sharp able to rasterise a trusted SVG, and still refuses it as a logo", async () => {
    // next/og draws opengraph-image as SVG and rasterises it with sharp.
    // A process-wide block breaks that build. The logo gate is the boundary.
    const png = await sharp(svg, { density: 72 }).png().toBuffer();
    expect(isPng(new Uint8Array(png))).toBe(true);
    expect(logoRejection("events/abc/logo/logo.svg", svg)).toBe("Use a PNG, JPG or WebP logo");
  });

  it("accepts only the logo and cover paths the uploaders write", () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const albumId = "22222222-2222-4222-8222-222222222222";
    expect(isEventLogoPath(eventId, `events/${eventId}/logo/logo-1727000000000.png`)).toBe(true);
    expect(isEventLogoPath(eventId, `events/${eventId}/logo/logo-1.jpeg`)).toBe(true);
    expect(isEventLogoPath(eventId, `events/${eventId}/logo/logo-1.webp`)).toBe(true);
    expect(isEventLogoPath(eventId, `events/${eventId}/logo/logo.png`)).toBe(false);
    expect(isEventLogoPath(eventId, `events/${eventId}/logo/logo-1.svg`)).toBe(false);
    expect(isEventLogoPath(eventId, `events/${eventId}/logo/logo-1.png/../../other.png`)).toBe(false);
    expect(isEventLogoPath(eventId, `events/other/logo/logo-1.png`)).toBe(false);

    expect(isAlbumCoverPath(eventId, albumId, `events/${eventId}/covers/${albumId}-1727000000000.jpg`)).toBe(true);
    expect(isAlbumCoverPath(eventId, albumId, `events/${eventId}/covers/${albumId}-1.png`)).toBe(true);
    expect(isAlbumCoverPath(eventId, albumId, `events/${eventId}/covers/cover.png`)).toBe(false);
    expect(isAlbumCoverPath(eventId, albumId, `events/${eventId}/covers/${albumId}-1.svg`)).toBe(false);
  });

  it("treats photo signatures as decodable and SVG as not", () => {
    const heic = new Uint8Array(12);
    heic.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(isHeic(heic)).toBe(true);
    expect(isDecodablePhoto(heic)).toBe(true);
    expect(isDecodablePhoto(svg)).toBe(false);
    expect(isRasterLogo(svg)).toBe(false);
  });

  it("caps gallery pixels above a 60MP frame, and logos and crops lower", async () => {
    // 9504×6336 is a current 60MP full-frame file. 40 million would reject it.
    expect(GALLERY_MAX_INPUT_PIXELS).toBeGreaterThanOrEqual(9504 * 6336);
    expect(GALLERY_MAX_INPUT_PIXELS).toBe(80_000_000);
    expect(GALLERY_MAX_INPUT_PIXELS).toBeLessThan(268_402_689);
    expect(LOGO_MAX_INPUT_PIXELS).toBe(25_000_000);
    expect(CROP_MAX_INPUT_PIXELS).toBe(40_000_000);
    expect(sharpDecodeOptions).toEqual({ limitInputPixels: GALLERY_MAX_INPUT_PIXELS, failOn: "error" });
    expect(logoDecodeOptions).toEqual({ limitInputPixels: LOGO_MAX_INPUT_PIXELS, failOn: "error" });
    expect(cropDecodeOptions).toEqual({ limitInputPixels: CROP_MAX_INPUT_PIXELS, failOn: "error" });

    const png = await sample("png");
    const mark = await rasterLogoMark(png, 16);
    expect(isWebp(new Uint8Array(mark))).toBe(true);

    const wide = await sharp({ create: { width: 200, height: 50, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    await expect(sharp(wide, { limitInputPixels: 100, failOn: "error" }).metadata()).rejects.toThrow();
  });

  it("deletes only keys under the caller's prefix, never a path that climbs out", () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const albumId = "22222222-2222-4222-8222-222222222222";
    const logoPrefix = `events/${eventId}/logo/`;
    const coverPrefix = `events/${eventId}/covers/${albumId}`;
    expect(isDeletableStorageKey(`${logoPrefix}logo-1.png`, logoPrefix)).toBe(true);
    expect(isDeletableStorageKey(`${logoPrefix}../../other.png`, logoPrefix)).toBe(false);
    expect(isDeletableStorageKey(`events/other/logo/logo-1.png`, logoPrefix)).toBe(false);
    expect(isDeletableStorageKey(`${coverPrefix}-1.jpg`, coverPrefix)).toBe(true);
    expect(isDeletableStorageKey(`${coverPrefix}-1.jpg/../../../secret.png`, coverPrefix)).toBe(false);
    expect(isDeletableStorageKey(`events/${eventId}/covers/other-1.jpg`, coverPrefix)).toBe(false);
    expect(isDeletableStorageKey("", logoPrefix)).toBe(false);
  });
});

describe("raster media migration", () => {
  const sql = readFileSync("supabase/migrations/20261021000037_raster_media.sql", "utf8");

  it("revokes logo_path and rejects only a new non-raster path", () => {
    expect(sql).toContain("revoke update (logo_path) on table public.events from authenticated");
    expect(sql).not.toContain("not valid");
    expect(sql).toContain("drop constraint if exists events_logo_path_raster");
    expect(sql).toContain("drop constraint if exists albums_cover_path_raster");
    expect(sql).toContain("new.logo_path is not distinct from old.logo_path");
    expect(sql).toContain("new.cover_path is not distinct from old.cover_path");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("current_user in ('service_role', 'postgres', 'supabase_admin')");
    expect(sql).not.toContain("current_user <> 'authenticated'");
    expect(sql).toContain("cover_path is set by the server");
    expect(sql).not.toContain("security definer");
  });

  it("allow-lists the gallery MIME types and leaves SVG out", () => {
    for (const type of EVENT_MEDIA_MIME_TYPES) expect(sql).toContain(`'${type}'`);
    for (const type of Object.keys(ACCEPTED_TYPES)) expect(EVENT_MEDIA_MIME_TYPES).toContain(type);
    expect(sql).not.toContain("'image/svg+xml'");
    expect(EVENT_MEDIA_MIME_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "video/mp4",
      "video/quicktime",
    ]);
  });
});

describe("photo pipeline gates", () => {
  const indexMedia = readFileSync("lib/faces/index-media.ts", "utf8");
  const crop = readFileSync("app/api/faces/[matchId]/crop/route.ts", "utf8");
  const backfill = readFileSync("scripts/backfill-faces.ts", "utf8");
  const actions = readFileSync("app/(app)/admin/actions.ts", "utf8");

  it("checks a photo signature before sharp in the face job, the crop route and the backfill", () => {
    for (const source of [indexMedia, backfill]) {
      expect(source).toContain("isDecodablePhoto");
      expect(source).toContain("sharpDecodeOptions");
      expect(source).not.toMatch(/sharp\(\s*bytes\s*\)/);
    }
    expect(crop).toContain("isDecodablePhoto");
    expect(crop).toContain("cropDecodeOptions");
    expect(crop).toContain(".extract(");
    expect(crop).not.toContain("resolveWithObject");
    expect(crop).not.toMatch(/sharp\(\s*bytes\s*\)/);
  });

  it("writes logo and cover paths with the admin client after the path check", () => {
    expect(actions).toContain("isEventLogoPath");
    expect(actions).toContain("isAlbumCoverPath");
    expect(actions).toContain("isDeletableStorageKey");
    expect(actions).toContain('.eq("event_id", album.event_id)');
    expect(actions).toContain('.update({ logo_path: path })');
    expect(actions).toContain('.update({ cover_path: path, cover_media_id: null })');
    expect(actions).toContain("createAdminClient().from(\"events\").update({ logo_path: path })");
    expect(actions).toContain("createAdminClient().from(\"albums\").update({ cover_path: path, cover_media_id: null })");
  });
});

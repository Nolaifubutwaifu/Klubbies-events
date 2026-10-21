import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { isPng, isRasterLogo, isWebp, logoRejection, looksLikeSvg, rasterLogoMark } from "@/lib/media/logo-file";

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
});

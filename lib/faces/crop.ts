import type { BoundingBox } from "@/lib/faces/queries";

/** Room around Rekognition's box, which is tight to the face. A crop with no
    hair or chin in it is oddly hard to recognise yourself in. */
export const CROP_PAD = 0.6;

/**
 * The square, in pixels, that "Is this you?" shows for a face.
 *
 * Rekognition's box is a fraction of the width and a fraction of the height,
 * which are different units on anything that isn't square. The old client-side
 * crop compared the two directly, so on a landscape photo it scaled to the
 * height fraction and showed most of the frame shrunk into a grey tile. This
 * works in pixels, keeps the square inside the image, and centres the face
 * wherever the edges allow.
 */
export function faceSquare(
  box: BoundingBox,
  imageWidth: number,
  imageHeight: number,
  pad = CROP_PAD,
): { left: number; top: number; size: number } {
  const faceW = box.Width * imageWidth;
  const faceH = box.Height * imageHeight;
  const centreX = (box.Left + box.Width / 2) * imageWidth;
  const centreY = (box.Top + box.Height / 2) * imageHeight;
  const size = Math.max(1, Math.round(Math.min(Math.max(faceW, faceH) * (1 + pad), imageWidth, imageHeight)));
  const clamp = (value: number, max: number) => Math.round(Math.min(Math.max(value, 0), Math.max(0, max)));
  return {
    left: clamp(centreX - size / 2, imageWidth - size),
    top: clamp(centreY - size / 2, imageHeight - size),
    size,
  };
}

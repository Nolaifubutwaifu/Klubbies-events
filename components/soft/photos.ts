/** Event photos in /public/marketing, shared by the landing page's photo bands. */
export type Photo = { src: string; pos?: string };

export const EVENT_PHOTOS: Photo[] = [
  { src: "/marketing/night-ball.jpg" },
  { src: "/marketing/night-dancefloor.jpg" },
  { src: "/marketing/hero-1.jpg" },
  { src: "/marketing/night-grandfinal.jpg" },
  { src: "/marketing/hero-2.jpg" },
  { src: "/marketing/night-bigone.jpg" },
  { src: "/marketing/hero-3.jpg" },
  { src: "/marketing/hero-4.jpg" },
];

/** Crops, cycled across a band so a repeated photo never reads as a repeat. */
const CROPS = ["center", "top", "bottom", "left", "right", "30% 20%", "70% 40%", "20% 70%", "80% 25%", "40% 80%"];

/** Fills `count` tiles from the pool, varying the crop each time round. */
export function bandTiles(count: number, pool: Photo[] = EVENT_PHOTOS): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    src: pool[i % pool.length].src,
    pos: CROPS[i % CROPS.length],
  }));
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klubbies Events",
    short_name: "Events",
    description: "Private event photos. Every attendee finds the ones they're in.",
    start_url: "/events",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#f7f7f5",
    // PNGs too, for home screens and browsers that skip SVG (audit F10).
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

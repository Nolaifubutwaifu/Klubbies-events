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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

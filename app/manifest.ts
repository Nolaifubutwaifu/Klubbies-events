import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klubbies",
    short_name: "Klubbies",
    description: "Your club's photos, for your club only.",
    start_url: "/clubs",
    display: "standalone",
    background_color: "#fff8f4",
    theme_color: "#fff8f4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

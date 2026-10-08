import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg runs as a separate binary for server-side video previews
  // (lib/media/video-previews.ts): keep it out of the bundle and ship the file.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    // The real file under .pnpm: the node_modules/ffmpeg-static symlink made
    // Vercel reject the function package.
    "/api/cron/hourly": ["./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg runs as a separate binary for server-side video previews
  // (lib/media/video-previews.ts): keep it out of the bundle and ship the file.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/cron/hourly": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;

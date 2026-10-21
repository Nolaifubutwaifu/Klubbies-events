import type { NextConfig } from "next";

// Static on every response, including the paths the proxy skips (files,
// /api/cron, /api/stripe, /api/csp-report). CSP and Permissions-Policy are
// per request, so the proxy sets those. poweredByHeader is set on another branch.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Omit the x-powered-by header. Next.js adds it unless this is false.
  poweredByHeader: false,
  // ffmpeg runs as a separate binary for server-side video previews
  // (lib/media/video-previews.ts): keep it out of the bundle and ship the file.
  serverExternalPackages: ["ffmpeg-static"],
  // /index served a second copy of the home page (SEO audit F8).
  redirects: async () => [{ source: "/index", destination: "/", permanent: true }],
  outputFileTracingIncludes: {
    // The real file under .pnpm: the node_modules/ffmpeg-static symlink made
    // Vercel reject the function package.
    "/api/cron/hourly": ["./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg"],
  },
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;

// Content-Security-Policy and Permissions-Policy for one request.
// Origins come from env so preview, local and production each name their
// own Supabase project and R2 bucket. Phase 1 sends this as Report-Only;
// the header name lives in proxy.ts so enforcing is a one-line flip.

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** A host we can drop into a CSP source without breaking the header. */
function isCspHost(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{0,200}$/i.test(value) && !value.endsWith(".") && !value.includes("..");
}

/**
 * Hosts the browser actually loads for photos and video.
 *
 * r2Client() only sets forcePathStyle when R2_ENDPOINT is set. Otherwise the
 * AWS SDK signs virtual-hosted URLs, https://<bucket>.<account>.r2.cloudflarestorage.com/<key>.
 * CSP wildcards match a single label, so https://*.r2.cloudflarestorage.com
 * does not cover that host. There is no two-label wildcard.
 */
function r2Origins(): string[] {
  const endpoint = origin(process.env.R2_ENDPOINT);
  if (endpoint) return [endpoint];
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const bucket = process.env.R2_BUCKET?.trim() ?? "";
  if (isCspHost(accountId) && isCspHost(bucket)) {
    return [`https://${bucket}.${accountId}.r2.cloudflarestorage.com`];
  }
  return ["https://*.r2.cloudflarestorage.com"];
}

/** tus uploads go to <ref>.storage.supabase.co, the same rewrite as upload-queue.ts. */
function storageOrigin(supabase: string | null): string | null {
  if (!supabase?.endsWith(".supabase.co")) return null;
  return supabase.replace(".supabase.co", ".storage.supabase.co");
}

export function buildCsp(nonce: string): string {
  const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseStorage = storageOrigin(supabase);
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isDev = process.env.NODE_ENV === "development";

  const storage = [supabase, supabaseStorage, ...r2Origins()].filter((value): value is string => Boolean(value));
  const vercelLive = isPreview ? ["https://vercel.live"] : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // No 'unsafe-eval'. HEIC previews use heic-to/csp, which is a blob worker
    // (worker-src) and does not call eval or WebAssembly. Do not add
    // 'wasm-unsafe-eval' unless a browser build of that package starts
    // compiling WASM.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'report-sample'",
      ...vercelLive,
    ],
    // No nonce here. A nonce makes browsers ignore 'unsafe-inline', and React
    // style attributes cannot carry one.
    "style-src": ["'self'", "'unsafe-inline'", ...vercelLive],
    "img-src": ["'self'", "data:", "blob:", ...storage, ...(isPreview ? ["https://vercel.live", "https://vercel.com"] : [])],
    "media-src": ["'self'", "blob:", ...storage],
    "font-src": ["'self'", ...(isPreview ? ["https://vercel.live", "https://assets.vercel.com"] : [])],
    "connect-src": [
      "'self'",
      ...storage,
      ...(isPreview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
      ...(isDev ? ["ws:"] : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": isPreview ? ["https://vercel.live"] : ["'none'"],
    "child-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://checkout.stripe.com", "https://billing.stripe.com"],
    "frame-ancestors": ["'none'"],
    "report-uri": [CSP_REPORT_PATH],
    "report-to": ["csp"],
  };
  if (!isDev) directives["upgrade-insecure-requests"] = [];

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

export const CSP_REPORT_PATH = "/api/csp-report";

/** Absolute in production (from APP_URL). A path works, an absolute URL is what browsers handle best. */
export function reportingEndpoints(): string {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (base) {
    try {
      const url = new URL(CSP_REPORT_PATH, `${base}/`);
      if (url.protocol === "http:" || url.protocol === "https:") return `csp="${url.origin}${CSP_REPORT_PATH}"`;
    } catch {
      // Fall through to the path.
    }
  }
  return `csp="${CSP_REPORT_PATH}"`;
}

const PP_DENY = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=(self)",
  "bluetooth=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
  "clipboard-write=(self)",
  "web-share=(self)",
  "fullscreen=(self)",
  "picture-in-picture=(self)",
];

/** The selfie page: /e/<handle>/me and anything under it. */
export const SELFIE_PATH = /^\/e\/[^/]+\/me(\/|$)/;

export function permissionsPolicy(pathname: string): string {
  const list = SELFIE_PATH.test(pathname) ? PP_DENY.map((part) => (part === "camera=()" ? "camera=(self)" : part)) : PP_DENY;
  return list.join(", ");
}

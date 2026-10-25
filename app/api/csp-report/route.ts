import { LIMITS, hitRateLimit } from "@/lib/auth/rate-limit";
import { NextResponse } from "next/server";

const MAX_BYTES = 16 * 1024;
const ACCEPTED = ["application/csp-report", "application/reports+json", "application/json"];

// Guest upload links are the credential. The token is a path segment on
// /g/<token> and /api/guest/<token>/…, so dropping the query string does not
// hide it. Same shape resolveGuestLink accepts: 4–64 of [A-Za-z0-9-].
const GUEST_TOKEN = "[A-Za-z0-9-]{4,64}";

function redactPathSecrets(value: string): string {
  return value
    .replaceAll(new RegExp(`/api/guest/${GUEST_TOKEN}(?=[/?#]|$)`, "g"), "/api/guest/[redacted]")
    .replaceAll(new RegExp(`/g/${GUEST_TOKEN}(?=[/?#]|$)`, "g"), "/g/[redacted]");
}

// Signed Supabase and R2 URLs, and the unsubscribe links, carry their token
// in the query string. Reports name those URLs as the document or the blocked
// resource. Drop the query, then mask any guest token still sitting in the path.
function loggedUrl(value: unknown, max: number): string {
  const stripped = String(value ?? "").split("?")[0];
  return redactPathSecrets(stripped).slice(0, max);
}

function loggedText(value: unknown, max: number): string {
  return redactPathSecrets(String(value ?? "")).slice(0, max);
}

// Same first-hop rule as clientFingerprint. Read it off this request: the
// report route is outside the proxy, and a unit test has no next/headers().
function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}

// Browsers POST CSP violations here (report-uri and the Reporting API).
// Public on purpose: reports carry no credentials. It logs, and it records a
// rate-limit hit. It does not set cookies or touch auth. The proxy does not
// run on it.
export async function POST(request: Request) {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED.includes(type)) return new NextResponse(null, { status: 415 });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return new NextResponse(null, { status: 413 });

  // Before the body is read, so a flood never reaches the log or the parser.
  if (await hitRateLimit(LIMITS.cspReportPerIp, clientIp(request))) {
    return new NextResponse(null, { status: 429 });
  }

  const reader = request.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    chunks.push(value);
  }

  let body: unknown;
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const reports = Array.isArray(body) ? body : [body];
  for (const report of reports.slice(0, 20)) {
    const entry = report as { body?: Record<string, unknown>; "csp-report"?: Record<string, unknown> };
    const fields = entry["csp-report"] ?? entry.body ?? {};
    console.warn(
      "csp-report",
      JSON.stringify({
        doc: loggedUrl(fields["document-uri"] ?? fields.documentURL, 300),
        directive: loggedText(fields["effective-directive"] ?? fields.effectiveDirective ?? fields["violated-directive"], 100),
        blocked: loggedUrl(fields["blocked-uri"] ?? fields.blockedURL, 300),
        source: loggedUrl(fields["source-file"] ?? fields.sourceFile, 300),
        line: fields["line-number"] ?? fields.lineNumber ?? null,
        sample: loggedText(fields["script-sample"] ?? fields.sample, 120),
        disposition: fields.disposition ?? null,
      }),
    );
  }
  return new NextResponse(null, { status: 204 });
}

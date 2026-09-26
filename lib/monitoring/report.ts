import { Resend } from "resend";

type ErrorContext = { path: string; method: string; routerKind: string; routeType: string };

const THROTTLE_MS = 15 * 60 * 1000;
const lastSent = new Map<string, number>();

/**
 * Logs every server error as structured JSON (visible in Vercel logs) and,
 * when ALERT_EMAIL is set, emails it — at most once per 15 minutes per
 * route and message on each server instance.
 */
export async function reportServerError(err: unknown, context: ErrorContext): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  const path = context.path.split("?")[0];
  const stack = err instanceof Error ? err.stack : undefined;

  console.error(JSON.stringify({ level: "error", source: "onRequestError", message, digest, path, method: context.method, routeType: context.routeType }));

  const to = process.env.ALERT_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey || process.env.EMAIL_DRY_RUN === "1") return;

  const key = `${path}:${message}`.slice(0, 500);
  const now = Date.now();
  if ((lastSent.get(key) ?? 0) > now - THROTTLE_MS) return;
  lastSent.set(key, now);

  try {
    await new Resend(apiKey).emails.send({
      from: process.env.EMAIL_FROM ?? "Klubbies <onboarding@resend.dev>",
      to,
      subject: `[Klubbies error] ${message.slice(0, 90)}`,
      text: [
        `Path: ${context.method} ${path}`,
        `Route: ${context.routeType} (${context.routerKind})`,
        `Digest: ${digest ?? "-"}`,
        `Time: ${new Date(now).toISOString()}`,
        "",
        stack ?? message,
      ].join("\n"),
    });
  } catch (sendError) {
    console.error("error alert email failed", sendError);
  }
}

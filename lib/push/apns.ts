import "server-only";
import { sign } from "node:crypto";
import { connect, type ClientHttp2Session } from "node:http2";
import { serverEnv } from "@/lib/env";

/**
 * Sends notifications through Apple's push service (APNs) with a token-based
 * key: a JWT signed with the .p8 key, reused for up to 50 minutes as Apple
 * asks, over one HTTP/2 connection per batch. No SDK: it is one POST per
 * device.
 */

export type ApnsEnvironment = "sandbox" | "production";
export type PushMessage = { title: string; body: string; url: string; threadId?: string };
export type PushResult = { token: string; ok: boolean; status: number; reason?: string };

const HOSTS: Record<ApnsEnvironment, string> = {
  sandbox: "https://api.sandbox.push.apple.com",
  production: "https://api.push.apple.com",
};

export function apnsConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY);
}

let cached: { jwt: string; issuedAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Exported for the unit test; everything else goes through sendPush. */
export function providerToken(keyId: string, teamId: string, privateKey: string, now = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), {
    key: privateKey.replace(/\\n/g, "\n"),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${claims}.${base64url(signature)}`;
}

function currentToken(): string {
  const env = serverEnv();
  const now = Date.now();
  if (!cached || now - cached.issuedAt > 50 * 60 * 1000) {
    cached = { jwt: providerToken(env.APNS_KEY_ID!, env.APNS_TEAM_ID!, env.APNS_PRIVATE_KEY!, now), issuedAt: now };
  }
  return cached.jwt;
}

function post(session: ClientHttp2Session, token: string, payload: string, jwt: string, topic: string, threadId?: string): Promise<PushResult> {
  return new Promise((resolve) => {
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      ...(threadId ? { "apns-collapse-id": threadId.slice(0, 64) } : {}),
    });
    let status = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      let reason: string | undefined;
      try {
        reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined;
      } catch {
        reason = body || undefined;
      }
      resolve({ token, ok: status === 200, status, reason });
    });
    request.on("error", (error) => resolve({ token, ok: false, status, reason: error.message }));
    request.setTimeout(10_000, () => {
      request.close();
      resolve({ token, ok: false, status, reason: "timeout" });
    });
    request.end(payload);
  });
}

/** Sends one message to many devices of one environment. Never throws. */
export async function sendPush(environment: ApnsEnvironment, tokens: string[], message: PushMessage): Promise<PushResult[]> {
  if (!apnsConfigured() || tokens.length === 0) return [];
  const env = serverEnv();
  const payload = JSON.stringify({
    aps: { alert: { title: message.title, body: message.body }, sound: "default", "thread-id": message.threadId },
    url: message.url,
  });

  let session: ClientHttp2Session | null = null;
  try {
    session = connect(HOSTS[environment]);
    session.on("error", (error) => console.error("apns session", error));
    const jwt = currentToken();
    const results: PushResult[] = [];
    // A few at a time: plenty for an event, and gentle on one connection.
    for (let i = 0; i < tokens.length; i += 20) {
      const batch = tokens.slice(i, i + 20);
      results.push(...(await Promise.all(batch.map((token) => post(session!, token, payload, jwt, env.APNS_BUNDLE_ID, message.threadId)))));
    }
    return results;
  } catch (error) {
    console.error("apns send failed", error);
    return tokens.map((token) => ({ token, ok: false, status: 0, reason: String(error) }));
  } finally {
    session?.close();
  }
}

/** Apple's answers that mean the token will never work again. */
export function isDeadToken(result: PushResult): boolean {
  return result.status === 410 || result.reason === "BadDeviceToken" || result.reason === "Unregistered" || result.reason === "DeviceTokenNotForTopic";
}

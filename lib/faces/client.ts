import "server-only";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { serverEnv } from "@/lib/env";

// Absence of AWS credentials is a configuration state, not an error: a dev
// machine without them boots, the worker no-ops, and no club can turn the
// feature on. Everything downstream checks for null rather than catching.

let cached: RekognitionClient | null | undefined;

export function faceClient(): RekognitionClient | null {
  if (cached !== undefined) return cached;
  const env = serverEnv();
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    cached = null;
    return cached;
  }
  cached = new RekognitionClient({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

/** True when the app is configured to do face recognition at all. */
export function facesConfigured(): boolean {
  return faceClient() !== null;
}

/**
 * Collection id for a club. Both this and ExternalImageId accept letters,
 * digits, underscore, hyphen, period and colon, so a raw UUID is safe to
 * interpolate.
 */
export function collectionIdFor(clubId: string): string {
  return `${serverEnv().REKOGNITION_COLLECTION_PREFIX}-club-${clubId}`;
}

/** `media:{mediaId}` — a face found in a club photo. */
export function mediaExternalId(mediaId: string): string {
  return `media:${mediaId}`;
}

/** `ref:{membershipId}` — a reference face for an enrolled member. */
export function referenceExternalId(membershipId: string): string {
  return `ref:${membershipId}`;
}

export function parseExternalId(value: string | undefined): { kind: "media" | "ref"; id: string } | null {
  if (!value) return null;
  const at = value.indexOf(":");
  if (at < 0) return null;
  const kind = value.slice(0, at);
  const id = value.slice(at + 1);
  if (kind !== "media" && kind !== "ref") return null;
  return { kind, id };
}

/** AWS throttling and quota errors are worth backing off on, not retrying hard. */
export function isThrottling(error: unknown): boolean {
  const name = (error as { name?: string })?.name ?? "";
  return name === "ThrottlingException" || name === "ProvisionedThroughputExceededException" || name === "LimitExceededException";
}

import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is not set"),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(3).default("Klubbies <onboarding@resend.dev>"),
  APP_URL: z.url(),
  SIGNED_URL_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(16),
  // Test-only: shortens every signed URL so expiry can be exercised quickly.
  SIGNED_URL_TTL_OVERRIDE_SECONDS: z.coerce.number().int().positive().optional(),
  // Face recognition (AWS Rekognition). Every one of these is optional on
  // purpose: a dev machine with no AWS credentials still boots, and the face
  // worker no-ops instead of throwing. Absence disables the feature, it is
  // never a configuration error.
  AWS_REGION: z.string().min(1).default("ap-southeast-2"),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  REKOGNITION_COLLECTION_PREFIX: z.string().regex(/^[a-zA-Z0-9_.\-]+$/).default("klubbies-dev"),
});

export type ServerEnv = z.infer<typeof schema>;

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * "klubbies.example/c/uq_vb": the club's shareable address as people see it.
 * Everything that shows the address calls this, so the rail, the setup
 * checklist and Settings can't drift apart again (the rail once hardcoded a
 * domain the app wasn't served from).
 */
export function clubAddress(handle: string): string {
  return `${appUrl().replace(/^https?:\/\//, "")}/c/${handle}`;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}

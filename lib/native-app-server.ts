import "server-only";
import { headers } from "next/headers";
import { isNativeAppUserAgent } from "./native-app";

/**
 * True when this request comes from the iPhone app. Apple allows no payment
 * prompts inside it (see docs/decisions.md, 137), so pages use this to leave
 * them out.
 */
export async function isNativeAppRequest(): Promise<boolean> {
  return isNativeAppUserAgent((await headers()).get("user-agent"));
}

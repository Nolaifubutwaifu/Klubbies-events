import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { apnsConfigured, isDeadToken, sendPush, type ApnsEnvironment, type PushMessage } from "./apns";

/**
 * Pushes one message to every iPhone of the given people, and forgets any
 * token Apple says is dead (app deleted, notifications reset). Never throws:
 * a failed push must never fail the publish or post that caused it.
 */
export async function pushToUsers(userIds: string[], message: PushMessage): Promise<number> {
  if (!apnsConfigured() || userIds.length === 0) return 0;
  try {
    const admin = createAdminClient();
    const { data: devices } = await admin.from("push_devices").select("token, environment").in("user_id", [...new Set(userIds)]);
    if (!devices?.length) return 0;

    let delivered = 0;
    const dead: string[] = [];
    for (const environment of ["production", "sandbox"] as ApnsEnvironment[]) {
      const tokens = devices.filter((d) => d.environment === environment).map((d) => d.token);
      for (const result of await sendPush(environment, tokens, message)) {
        if (result.ok) delivered += 1;
        else if (isDeadToken(result)) dead.push(result.token);
        else console.error("push not delivered", result.status, result.reason);
      }
    }
    if (dead.length) await admin.from("push_devices").delete().in("token", dead);
    return delivered;
  } catch (error) {
    console.error("push failed", error);
    return 0;
  }
}

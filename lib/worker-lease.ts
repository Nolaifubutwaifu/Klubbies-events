import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sleep } from "@/lib/retry";

/** How long a drain keeps the lease without renewing. Renewed every batch. */
const LEASE_SECONDS = 30;

export function isMissingLeaseRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    /could not find the function/i.test(message) ||
    /schema cache/i.test(message) ||
    /try_worker_lease|release_worker_lease|try_rekognition_slot|release_rekognition_slot/i.test(message)
  );
}

let warned = false;

function warnMissing(): void {
  if (warned) return;
  warned = true;
  console.error("worker lease is not installed; drains overlap until migration 039 is applied");
}

/**
 * One drain at a time. "busy" means another invocation holds the lease and
 * this one should leave the queued jobs for it (or for the hourly cron).
 * If the migration is not applied yet, the work runs anyway.
 */
export async function withWorkerLease<T>(
  name: string,
  fn: (renew: () => Promise<boolean>) => Promise<T>,
): Promise<T | "busy"> {
  const admin = createAdminClient();
  const holder = crypto.randomUUID();
  const acquire = () => admin.rpc("try_worker_lease", { p_name: name, p_holder: holder, p_seconds: LEASE_SECONDS });

  const first = await acquire();
  if (first.error) {
    if (!isMissingLeaseRpc(first.error)) throw first.error;
    warnMissing();
    return fn(async () => true);
  }
  if (!first.data) return "busy";

  const renew = async () => {
    const again = await acquire();
    if (again.error) {
      if (isMissingLeaseRpc(again.error)) return true;
      throw again.error;
    }
    return Boolean(again.data);
  };
  try {
    return await fn(renew);
  } finally {
    const released = await admin.rpc("release_worker_lease", { p_name: name, p_holder: holder });
    if (released.error && !isMissingLeaseRpc(released.error)) console.error("could not release lease", name, released.error);
  }
}

/**
 * Caps Rekognition calls across every server instance. A full cap waits
 * briefly, then throws a throttling error so the face job is put back
 * without spending an attempt. Missing migration: no cap.
 */
export async function withRekognitionSlot<T>(max: number, fn: () => Promise<T>): Promise<T> {
  const admin = createAdminClient();
  const holder = crypto.randomUUID();
  const deadline = Date.now() + 25_000;
  let held = false;
  while (!held) {
    const { data, error } = await admin.rpc("try_rekognition_slot", {
      p_holder: holder,
      p_max: max,
      p_ttl_seconds: 90,
    });
    if (error) {
      if (isMissingLeaseRpc(error)) {
        warnMissing();
        return fn();
      }
      throw error;
    }
    if (data) {
      held = true;
      break;
    }
    if (Date.now() > deadline) {
      const busy = new Error("Rekognition concurrency cap");
      busy.name = "ThrottlingException";
      throw busy;
    }
    await sleep(200 + Math.random() * 300);
  }
  try {
    return await fn();
  } finally {
    const released = await admin.rpc("release_rekognition_slot", { p_holder: holder });
    if (released.error && !isMissingLeaseRpc(released.error)) console.error("could not release rekognition slot", released.error);
  }
}

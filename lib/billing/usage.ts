import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type JoinState = "open" | "overflow" | "full";

export type PlanUsage = {
  plan: string;
  planRate: string | null;
  guestLimit: number | null;
  photoLimit: number | null;
  guestsJoined: number;
  guestsPaused: number;
  /** Photos used, with video counted 1 per started 6 seconds. */
  unitsUsed: number;
  joinState: JoinState;
  overflowStartedAt: string | null;
  overflowClosedAt: string | null;
};

/** Postgres error codes raised by migration 27's limits. */
export const PHOTOS_FULL = "KB001";
export const GUESTS_FULL = "KB002";

export const EVENT_FULL_MESSAGE = "This event is full right now. We've let the organiser know.";
export const PHOTOGRAPHER_FULL_MESSAGE = "This event is full. Ask the organiser to make room.";

/** An event's plan, limits and what it has used, as the database counts them. */
export async function getPlanUsage(eventId: string): Promise<PlanUsage | null> {
  const { data, error } = await createAdminClient().rpc("event_plan_usage", { p_event_id: eventId });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    plan: row.plan,
    planRate: row.plan_rate,
    guestLimit: row.guest_limit,
    photoLimit: row.photo_limit,
    guestsJoined: row.guests_joined,
    guestsPaused: row.guests_paused,
    unitsUsed: row.units_used,
    joinState: (row.join_state as JoinState) ?? "open",
    overflowStartedAt: row.overflow_started_at,
    overflowClosedAt: row.overflow_closed_at,
  };
}

/** Whether a new guest could join right now. */
export async function eventIsFull(eventId: string): Promise<boolean> {
  return (await getPlanUsage(eventId))?.joinState === "full";
}

/**
 * The hourly pass: windows that have run their 48 hours close, and the
 * guests who joined last are paused. Returns the events it closed.
 */
export async function closeOverflowWindows(): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc("close_overflow_windows");
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

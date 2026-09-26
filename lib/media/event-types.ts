import type { EventType } from "@/lib/db/types";

/**
 * The label a member sees on an album card. The design shows one of these on
 * every album, so the list stays short enough to recognise at a glance.
 */
export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "sport", label: "Sport" },
  { value: "social", label: "Social" },
  { value: "camp", label: "Camp" },
  { value: "night_out", label: "Night out" },
  { value: "other", label: "Other" },
];

const LABELS = new Map(EVENT_TYPES.map((t) => [t.value as string, t.label]));

export function eventTypeLabel(value: string | null | undefined): string | null {
  return value ? (LABELS.get(value) ?? null) : null;
}

export function isEventType(value: string): value is EventType {
  return LABELS.has(value);
}

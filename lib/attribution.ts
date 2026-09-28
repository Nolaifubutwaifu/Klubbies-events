/**
 * Where an organiser came from (pricing handoff §5.9). Shared by the request
 * proxy, which remembers a tracked link, and event creation, which saves it.
 */

export const SOURCE_COOKIE = "kb_src";
/** Matches the database check on events.source. */
export const SOURCE_TAG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** The optional "How did you hear about us?" answers. */
export const HEARD_FROM: { value: string; label: string }[] = [
  { value: "flyer", label: "Flyer or poster" },
  { value: "social", label: "Instagram or TikTok" },
  { value: "email", label: "Email from Klubbies" },
  { value: "event", label: "At an event (saw the credit)" },
  { value: "photographer", label: "A photographer" },
  { value: "club", label: "Another club" },
  { value: "other", label: "Other" },
];

export function isHeardFrom(value: string): boolean {
  return HEARD_FROM.some((option) => option.value === value);
}

/** Tags for the credit line's links, so sign ups from it can be counted. */
export const CREDIT_SOURCE = { page: "credit", email: "credit-email" } as const;

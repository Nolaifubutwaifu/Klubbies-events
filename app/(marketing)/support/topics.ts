/** What the contact form asks people to pick. The label goes into the email subject. */
export const CONTACT_TOPICS = [
  { value: "help", label: "Help with an event" },
  { value: "report", label: "Report a photo or a person" },
  { value: "billing", label: "Billing or refunds" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "other", label: "Something else" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

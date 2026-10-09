import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type EventAnnouncementProps = {
  eventName: string;
  organiser: string;
  /** The organiser's own words, as plain text; blank lines start a new paragraph. */
  body: string;
  eventUrl: string;
  unsubscribeUrl: string;
};

/** The organiser's announcement, sent by us on their behalf (paid sizes). */
export default function EventAnnouncement({ eventName, organiser, body, eventUrl, unsubscribeUrl }: EventAnnouncementProps) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <EmailLayout preview={paragraphs[0]?.slice(0, 120) ?? `Photos from ${eventName}`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      {paragraphs.map((paragraph, i) => (
        <Text key={i} style={{ ...emailStyles.body, whiteSpace: "pre-line" }}>
          {paragraph}
        </Text>
      ))}
      <Link href={eventUrl} style={emailStyles.button}>
        Open the gallery
      </Link>
      <Text style={{ ...emailStyles.body, fontSize: 13, marginTop: 24 }}>
        Sent by Klubbies Events for {organiser}, because you&apos;re on the guest list for {eventName}.{" "}
        <Link href={unsubscribeUrl} style={emailStyles.link}>
          Stop emails about this event
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

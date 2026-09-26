import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type AccessEndingProps = {
  name: string;
  eventName: string;
  endsOn: string;
  eventUrl: string;
  unsubscribeUrl: string;
};

export default function AccessEnding({ name, eventName, endsOn, eventUrl, unsubscribeUrl }: AccessEndingProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`The ${eventName} gallery closes on ${endsOn}`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>The gallery closes on {endsOn}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, the photos from {eventName} stay open until <strong>{endsOn}</strong>. Download the ones you
        want to keep before then. After that the gallery closes for attendees.
      </Text>
      <Link href={eventUrl} style={emailStyles.button}>
        Open the gallery
      </Link>
      <Text style={{ ...emailStyles.body, fontSize: 14, marginTop: 24 }}>
        Don&apos;t want reminders like this? <Link href={unsubscribeUrl}>Turn them off</Link>.
      </Text>
    </EmailLayout>
  );
}

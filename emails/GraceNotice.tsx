import { Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./Layout";

export type GraceNoticeProps = {
  name: string;
  eventName: string;
  endsOn: string;
  eventUrl: string;
  finalNotice: boolean;
};

export default function GraceNotice({ name, eventName, endsOn, eventUrl, finalNotice }: GraceNoticeProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <EmailLayout preview={`Your access to ${eventName} ends on ${endsOn}`}>
      <Text style={emailStyles.kicker}>{eventName}</Text>
      <Text style={emailStyles.heading}>{finalNotice ? "Your access ends tomorrow" : `Access ends ${endsOn}`}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName}, the committee has taken you off the {eventName} member list. You can still open and download
        everything shared before that until <strong>{endsOn}</strong>. After that the event&apos;s albums close for
        you.
      </Text>
      <Link href={eventUrl} style={emailStyles.button}>
        Open the event albums
      </Link>
    </EmailLayout>
  );
}
